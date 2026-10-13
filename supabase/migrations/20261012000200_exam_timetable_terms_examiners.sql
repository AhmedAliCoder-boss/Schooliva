alter table public.exam_schedules
  add column academic_term_id uuid,
  add column examiner_teacher_id uuid,
  add constraint exam_schedules_academic_term_fk
    foreign key (school_id, academic_term_id)
    references public.academic_terms (school_id, id) on delete restrict,
  add constraint exam_schedules_examiner_teacher_fk
    foreign key (school_id, examiner_teacher_id)
    references public.teachers (school_id, id) on delete restrict;

create index exam_schedules_term_idx
  on public.exam_schedules (school_id, academic_term_id, scheduled_on);

create index exam_schedules_examiner_idx
  on public.exam_schedules (school_id, examiner_teacher_id, scheduled_on)
  where examiner_teacher_id is not null;

alter table public.exam_schedules
  add constraint exam_schedule_examiner_no_overlap
  exclude using gist (
    school_id with =,
    examiner_teacher_id with =,
    scheduled_on with =,
    tsrange(date '2000-01-01' + starts_at, date '2000-01-01' + ends_at, '[)') with &&
  ) where (examiner_teacher_id is not null);

create or replace function public.validate_exam_schedule_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  exam_row record;
  subject_class_id uuid;
  section_class_id uuid;
  term_row record;
  examiner_is_active boolean;
begin
  if new.academic_term_id is null or new.examiner_teacher_id is null then
    raise exception 'Exam schedules require an academic term and an examiner.';
  end if;

  select e.academic_session_id, e.starts_on, e.ends_on, e.status
  into exam_row
  from public.exam_subjects es
  join public.exams e on e.school_id = es.school_id and e.id = es.exam_id
  where es.school_id = new.school_id
    and es.id = new.exam_subject_id
  for key share of e, es;

  if not found then
    raise exception 'Exam subject could not be found in this school.';
  end if;

  select class_id into subject_class_id
  from public.exam_subjects
  where school_id = new.school_id and id = new.exam_subject_id;

  select class_id into section_class_id
  from public.sections
  where school_id = new.school_id and id = new.section_id
  for key share;

  if section_class_id is null or subject_class_id <> section_class_id then
    raise exception 'The exam section must belong to the exam subject class.';
  end if;

  select academic_session_id, starts_on, ends_on
  into term_row
  from public.academic_terms
  where school_id = new.school_id and id = new.academic_term_id
  for key share;

  if not found or term_row.academic_session_id <> exam_row.academic_session_id then
    raise exception 'The academic term must belong to the exam session.';
  end if;

  select employment_status = 'active' and is_active and deleted_at is null
  into examiner_is_active
  from public.teachers
  where school_id = new.school_id and id = new.examiner_teacher_id
  for key share;

  if not coalesce(examiner_is_active, false) then
    raise exception 'The exam examiner must be an active teacher in this school.';
  end if;

  if new.scheduled_on < exam_row.starts_on or new.scheduled_on > exam_row.ends_on
     or new.scheduled_on < term_row.starts_on or new.scheduled_on > term_row.ends_on then
    raise exception 'The exam date must fall within the exam and academic-term dates.';
  end if;

  if exam_row.status = 'published' then
    raise exception 'Published exam schedules cannot be changed.';
  end if;

  return new;
end;
$$;

create trigger exam_schedules_validate_assignment
before insert or update of exam_subject_id, section_id, academic_term_id, examiner_teacher_id, scheduled_on, starts_at, ends_at
on public.exam_schedules
for each row execute function public.validate_exam_schedule_assignment();
