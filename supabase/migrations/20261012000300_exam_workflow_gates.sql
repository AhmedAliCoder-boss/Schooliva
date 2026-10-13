create or replace function public.enforce_exam_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'published' and new.status <> 'published' then
    raise exception 'Published exams cannot move backwards';
  end if;
  if new.status = 'submitted' and old.status <> 'draft' then
    raise exception 'Only draft exams can be submitted';
  end if;
  if new.status = 'reviewed' and old.status <> 'submitted' then
    raise exception 'Only submitted exams can be reviewed';
  end if;
  if new.status = 'published' and old.status <> 'reviewed' then
    raise exception 'Only reviewed exams can be published';
  end if;

  if new.status = 'submitted' then
    if not exists (
      select 1 from public.exam_subjects es
      where es.school_id = new.school_id and es.exam_id = new.id
    ) then
      raise exception 'An exam needs at least one subject before submission';
    end if;

    if exists (
      select 1
      from public.exam_subjects es
      where es.school_id = new.school_id and es.exam_id = new.id
        and (
          not exists (
            select 1 from public.sections s
            where s.school_id = es.school_id and s.class_id = es.class_id and s.status = 'active'
          )
          or exists (
            select 1 from public.sections s
            where s.school_id = es.school_id and s.class_id = es.class_id and s.status = 'active'
              and not exists (
                select 1 from public.exam_schedules sched
                where sched.school_id = es.school_id and sched.exam_subject_id = es.id and sched.section_id = s.id
              )
          )
        )
    ) then
      raise exception 'Every exam subject must be scheduled for every active section';
    end if;
  end if;

  if new.status in ('reviewed', 'published') and exists (
    select 1
    from public.exam_subjects es
    join public.student_enrollments se
      on se.school_id = es.school_id
      and se.class_id = es.class_id
      and se.academic_session_id = new.academic_session_id
      and se.status = 'active'
    left join public.marks m
      on m.school_id = es.school_id
      and m.exam_subject_id = es.id
      and m.student_id = se.student_id
    where es.school_id = new.school_id and es.exam_id = new.id and m.id is null
  ) then
    raise exception 'Every enrolled student must have marks before results can be reviewed or published';
  end if;

  return new;
end;
$$;

create or replace function public.guard_exam_subject_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_exam_id uuid;
  target_school_id uuid;
  exam_status text;
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  target_exam_id := case when tg_op = 'DELETE' then old.exam_id else new.exam_id end;
  target_school_id := case when tg_op = 'DELETE' then old.school_id else new.school_id end;
  select e.status into exam_status
  from public.exams e
  where e.id = target_exam_id and e.school_id = target_school_id;

  if exam_status is distinct from 'draft' then
    raise exception 'Exam subjects can only be changed while the exam is a draft';
  end if;

  if tg_op <> 'DELETE' and not exists (
    select 1
    from public.class_subjects cs
    join public.classes c on c.id = cs.class_id and c.school_id = cs.school_id and c.status = 'active'
    join public.subjects s on s.id = cs.subject_id and s.school_id = cs.school_id and s.status = 'active'
    where cs.school_id = new.school_id and cs.class_id = new.class_id and cs.subject_id = new.subject_id
  ) then
    raise exception 'Exam subject must be assigned to an active class';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger exam_subjects_guard_workflow
before insert or update or delete on public.exam_subjects
for each row execute function public.guard_exam_subject_changes();

create or replace function public.guard_exam_schedule_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_subject_id uuid;
  target_school_id uuid;
  exam_status text;
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  target_subject_id := case when tg_op = 'DELETE' then old.exam_subject_id else new.exam_subject_id end;
  target_school_id := case when tg_op = 'DELETE' then old.school_id else new.school_id end;
  select e.status into exam_status
  from public.exam_subjects es
  join public.exams e on e.id = es.exam_id and e.school_id = es.school_id
  where es.id = target_subject_id and es.school_id = target_school_id;

  if exam_status is distinct from 'draft' then
    raise exception 'Exam schedules can only be changed while the exam is a draft';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger exam_schedules_guard_workflow
before insert or update or delete on public.exam_schedules
for each row execute function public.guard_exam_schedule_changes();

create or replace function public.guard_exam_mark_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_subject_id uuid;
  target_school_id uuid;
  target_student_id uuid;
  exam_status text;
  exam_session_id uuid;
  exam_class_id uuid;
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  target_subject_id := case when tg_op = 'DELETE' then old.exam_subject_id else new.exam_subject_id end;
  target_school_id := case when tg_op = 'DELETE' then old.school_id else new.school_id end;
  target_student_id := case when tg_op = 'DELETE' then old.student_id else new.student_id end;
  select e.status, e.academic_session_id, es.class_id
  into exam_status, exam_session_id, exam_class_id
  from public.exam_subjects es
  join public.exams e on e.id = es.exam_id and e.school_id = es.school_id
  where es.id = target_subject_id and es.school_id = target_school_id;

  if exam_status is distinct from 'submitted' then
    raise exception 'Exam marks can only be changed while the exam is submitted for marking';
  end if;

  if tg_op <> 'DELETE' and not exists (
    select 1 from public.student_enrollments se
    where se.school_id = target_school_id
      and se.student_id = target_student_id
      and se.class_id = exam_class_id
      and se.academic_session_id = exam_session_id
      and se.status = 'active'
  ) then
    raise exception 'Exam marks require an active student enrolment in the exam class and session';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger marks_guard_workflow
before insert or update or delete on public.marks
for each row execute function public.guard_exam_mark_changes();

create or replace function public.guard_exam_metadata_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status <> 'draft'
    and (new.name, new.starts_on, new.ends_on, new.academic_session_id, new.exam_type_id, new.grading_scale_id)
      is distinct from
      (old.name, old.starts_on, old.ends_on, old.academic_session_id, old.exam_type_id, old.grading_scale_id)
  then
    raise exception 'Exam details can only be changed while the exam is a draft';
  end if;
  return new;
end;
$$;

create trigger exams_guard_metadata_workflow
before update on public.exams
for each row execute function public.guard_exam_metadata_changes();

create or replace function public.guard_exam_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  if old.status <> 'draft' then
    raise exception 'Only draft exams can be deleted';
  end if;
  return old;
end;
$$;

create trigger exams_guard_delete_workflow
before delete on public.exams
for each row execute function public.guard_exam_deletion();
