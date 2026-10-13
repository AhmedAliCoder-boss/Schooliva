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
