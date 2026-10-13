do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.exams'::regclass
      and contype in ('u', 'p')
      and conkey = array[
        (select attnum from pg_attribute where attrelid = 'public.exams'::regclass and attname = 'school_id'),
        (select attnum from pg_attribute where attrelid = 'public.exams'::regclass and attname = 'id')
      ]::smallint[]
  ) then
    alter table public.exams
      add constraint exams_school_id_id_key unique (school_id, id);
  end if;
end;
$$;

create table public.exam_section_workflows (
  school_id uuid not null,
  exam_id uuid not null,
  section_id uuid not null,
  status text not null check (status in ('submitted', 'reviewed', 'published')),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (exam_id, section_id),
  foreign key (school_id, exam_id) references public.exams (school_id, id) on delete cascade,
  foreign key (school_id, section_id) references public.sections (school_id, id) on delete restrict
);

create index exam_section_workflows_school_status_idx
  on public.exam_section_workflows (school_id, exam_id, status);

insert into public.exam_section_workflows (school_id, exam_id, section_id, status)
select e.school_id, e.id, s.id, e.status
from public.exams e
join public.exam_subjects es on es.school_id = e.school_id and es.exam_id = e.id
join public.sections s on s.school_id = es.school_id and s.class_id = es.class_id and s.status = 'active'
where e.status in ('submitted', 'reviewed', 'published')
group by e.school_id, e.id, s.id, e.status;

alter table public.exam_section_workflows enable row level security;

create policy "Members can read exam section workflows"
on public.exam_section_workflows for select to authenticated
using (
  public.has_permission(school_id, 'exams', 'view')
  or public.has_permission(school_id, 'exams', 'manage')
  or public.has_permission(school_id, 'grading', 'manage')
  or public.is_super_admin()
);

create or replace function public.guard_exam_subject_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_exam_id uuid;
  target_school_id uuid;
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  target_exam_id := case when tg_op = 'DELETE' then old.exam_id else new.exam_id end;
  target_school_id := case when tg_op = 'DELETE' then old.school_id else new.school_id end;

  if exists (
    select 1 from public.exam_section_workflows w
    where w.exam_id = target_exam_id and w.school_id = target_school_id
  ) then
    raise exception 'Exam subjects cannot change after section marking starts';
  end if;
  if tg_op = 'UPDATE' and exists (
    select 1 from public.exam_section_workflows w
    where w.exam_id = old.exam_id and w.school_id = old.school_id
  ) then
    raise exception 'Exam subjects cannot change after section marking starts';
  end if;

  if not exists (
    select 1 from public.exams e
    where e.id = target_exam_id and e.school_id = target_school_id and e.status = 'draft'
  ) then
    raise exception 'Exam subjects can only be changed while the exam is being planned';
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

create or replace function public.guard_exam_schedule_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_subject_id uuid;
  target_school_id uuid;
  target_section_id uuid;
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  target_subject_id := case when tg_op = 'DELETE' then old.exam_subject_id else new.exam_subject_id end;
  target_school_id := case when tg_op = 'DELETE' then old.school_id else new.school_id end;
  target_section_id := case when tg_op = 'DELETE' then old.section_id else new.section_id end;

  if exists (
    select 1
    from public.exam_subjects es
    join public.exams e on e.id = es.exam_id and e.school_id = es.school_id
    where es.id = target_subject_id and es.school_id = target_school_id
      and (e.status <> 'draft' or e.status is null)
  ) then
    raise exception 'Exam schedules can only be changed while the exam is being planned';
  end if;

  if exists (
    select 1 from public.exam_section_workflows w
    where w.school_id = target_school_id and w.section_id = target_section_id
      and w.exam_id = (
        select es.exam_id from public.exam_subjects es
        where es.id = target_subject_id and es.school_id = target_school_id
      )
  ) then
    raise exception 'Schedules cannot change after this section is submitted for marking';
  end if;

  if tg_op = 'UPDATE' and exists (
    select 1 from public.exam_section_workflows w
    join public.exam_subjects es on es.exam_id = w.exam_id and es.school_id = w.school_id
    where w.school_id = old.school_id and w.section_id = old.section_id
      and es.id = old.exam_subject_id
  ) then
    raise exception 'Schedules cannot change after this section is submitted for marking';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

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
  exam_id uuid;
  exam_session_id uuid;
  exam_class_id uuid;
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  target_subject_id := case when tg_op = 'DELETE' then old.exam_subject_id else new.exam_subject_id end;
  target_school_id := case when tg_op = 'DELETE' then old.school_id else new.school_id end;
  target_student_id := case when tg_op = 'DELETE' then old.student_id else new.student_id end;
  select e.id, e.academic_session_id, es.class_id
  into exam_id, exam_session_id, exam_class_id
  from public.exam_subjects es
  join public.exams e on e.id = es.exam_id and e.school_id = es.school_id
  where es.id = target_subject_id and es.school_id = target_school_id;

  if not exists (
    select 1
    from public.student_enrollments se
    join public.exam_section_workflows w
      on w.school_id = se.school_id
      and w.exam_id = exam_id
      and w.section_id = se.section_id
      and w.status = 'submitted'
    where se.school_id = target_school_id
      and se.student_id = target_student_id
      and se.class_id = exam_class_id
      and se.academic_session_id = exam_session_id
      and se.status = 'active'
  ) then
    raise exception 'Exam marks require an active enrolment in a section submitted for marking';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.guard_exam_metadata_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    old.status <> 'draft'
    or exists (
      select 1 from public.exam_section_workflows w
      where w.exam_id = old.id and w.school_id = old.school_id
    )
  ) and
    (new.name, new.starts_on, new.ends_on, new.academic_session_id, new.exam_type_id, new.grading_scale_id)
      is distinct from
    (old.name, old.starts_on, old.ends_on, old.academic_session_id, old.exam_type_id, old.grading_scale_id)
  then
    raise exception 'Exam details can only be changed before section marking starts';
  end if;
  return new;
end;
$$;

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
  if old.status <> 'draft' or exists (
    select 1 from public.exam_section_workflows w
    where w.exam_id = old.id and w.school_id = old.school_id
  ) then
    raise exception 'Only exams with no section workflow started can be deleted';
  end if;
  return old;
end;
$$;

create or replace function public.enforce_exam_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  aggregate_status text;
begin
  if new.status = old.status then
    return new;
  end if;

  select case
    when count(*) > 0 and bool_and(w.status = 'published') then 'published'
    when count(*) > 0 and bool_and(w.status in ('reviewed', 'published')) then 'reviewed'
    when count(*) > 0 and bool_and(w.status in ('submitted', 'reviewed', 'published')) then 'submitted'
    else 'draft'
  end
  into aggregate_status
  from public.sections s
  join (
    select distinct es.class_id
    from public.exam_subjects es
    where es.school_id = new.school_id and es.exam_id = new.id
  ) exam_classes on exam_classes.class_id = s.class_id
  left join public.exam_section_workflows w
    on w.school_id = s.school_id and w.exam_id = new.id and w.section_id = s.id
  where s.school_id = new.school_id and s.status = 'active';

  if new.status is distinct from aggregate_status then
    raise exception 'Overall exam status must match progress across every active section';
  end if;
  if old.status = 'published' and new.status <> 'published' then
    raise exception 'Published exams cannot move backwards';
  end if;
  if new.status = 'submitted' and old.status <> 'draft' then
    raise exception 'Overall exam submission must follow draft';
  end if;
  if new.status = 'reviewed' and old.status <> 'submitted' then
    raise exception 'Overall exam review must follow submission';
  end if;
  if new.status = 'published' and old.status <> 'reviewed' then
    raise exception 'Overall exam publication must follow review';
  end if;
  return new;
end;
$$;

create or replace function public.transition_exam_section_workflow(
  p_school_id uuid,
  p_exam_id uuid,
  p_section_id uuid,
  p_next_status text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  exam_session_id uuid;
  section_class_id uuid;
  current_status text;
  aggregate_status text;
begin
  if not public.has_permission(p_school_id, 'exams', 'manage') and not public.is_super_admin() then
    raise exception 'Only exam managers can change exam section workflow';
  end if;
  if p_next_status is null or p_next_status not in ('submitted', 'reviewed', 'published') then
    raise exception 'Requested section workflow stage is invalid';
  end if;

  perform 1 from public.exams e
  where e.id = p_exam_id and e.school_id = p_school_id
  for update;
  if not found then
    raise exception 'Exam not found';
  end if;
  select e.academic_session_id, s.class_id
  into exam_session_id, section_class_id
  from public.exams e
  join public.sections s on s.school_id = e.school_id and s.id = p_section_id and s.status = 'active'
  where e.id = p_exam_id and e.school_id = p_school_id
    and exists (
      select 1 from public.exam_subjects es
      where es.school_id = e.school_id and es.exam_id = e.id and es.class_id = s.class_id
    );
  if not found then
    raise exception 'Selected section is not part of this exam';
  end if;

  select w.status into current_status
  from public.exam_section_workflows w
  where w.school_id = p_school_id and w.exam_id = p_exam_id and w.section_id = p_section_id;

  if p_next_status = 'submitted' then
    if current_status is not null then
      raise exception 'Section workflow must move from draft to submitted';
    end if;
    if not exists (
      select 1 from public.exam_subjects es
      where es.school_id = p_school_id and es.exam_id = p_exam_id and es.class_id = section_class_id
    ) or exists (
      select 1 from public.exam_subjects es
      where es.school_id = p_school_id and es.exam_id = p_exam_id and es.class_id = section_class_id
        and not exists (
          select 1 from public.exam_schedules sched
          where sched.school_id = p_school_id and sched.exam_subject_id = es.id
            and sched.section_id = p_section_id
        )
    ) then
      raise exception 'Schedule every exam subject for this section before submitting it for marking';
    end if;
  elsif p_next_status = 'reviewed' then
    if current_status is distinct from 'submitted' then
      raise exception 'Section workflow must move from submitted to reviewed';
    end if;
    if exists (
      select 1
      from public.exam_subjects es
      join public.student_enrollments se
        on se.school_id = es.school_id
        and se.class_id = es.class_id
        and se.academic_session_id = exam_session_id
        and se.section_id = p_section_id
        and se.status = 'active'
      left join public.marks m
        on m.school_id = es.school_id
        and m.exam_subject_id = es.id
        and m.student_id = se.student_id
      where es.school_id = p_school_id and es.exam_id = p_exam_id
        and es.class_id = section_class_id and m.id is null
    ) then
      raise exception 'Enter marks for every enrolled student in this section before review';
    end if;
  elsif current_status is distinct from 'reviewed' then
    raise exception 'Section workflow must move from reviewed to published';
  end if;

  insert into public.exam_section_workflows (school_id, exam_id, section_id, status)
  values (p_school_id, p_exam_id, p_section_id, p_next_status)
  on conflict (exam_id, section_id)
  do update set status = excluded.status, updated_at = timezone('utc', now());

  select case
    when count(*) > 0 and bool_and(w.status = 'published') then 'published'
    when count(*) > 0 and bool_and(w.status in ('reviewed', 'published')) then 'reviewed'
    when count(*) > 0 and bool_and(w.status in ('submitted', 'reviewed', 'published')) then 'submitted'
    else 'draft'
  end
  into aggregate_status
  from public.sections s
  join (
    select distinct es.class_id
    from public.exam_subjects es
    where es.school_id = p_school_id and es.exam_id = p_exam_id
  ) exam_classes on exam_classes.class_id = s.class_id
  left join public.exam_section_workflows w
    on w.school_id = s.school_id and w.exam_id = p_exam_id and w.section_id = s.id
  where s.school_id = p_school_id and s.status = 'active';

  update public.exams
  set status = aggregate_status
  where id = p_exam_id and school_id = p_school_id and status is distinct from aggregate_status;

  return aggregate_status;
end;
$$;

revoke all on function public.transition_exam_section_workflow(uuid, uuid, uuid, text) from public;
grant execute on function public.transition_exam_section_workflow(uuid, uuid, uuid, text) to authenticated;
