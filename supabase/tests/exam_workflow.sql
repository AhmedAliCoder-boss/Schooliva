begin;

select plan(14);

select ok(
  (select prosrc ilike '%Every exam subject must be scheduled for every active section%'
   from pg_proc where oid = 'public.enforce_exam_workflow()'::regprocedure),
  'exam submission requires a schedule for every active section'
);
select ok(
  (select prosrc ilike '%Every enrolled student must have marks%'
   from pg_proc where oid = 'public.enforce_exam_workflow()'::regprocedure),
  'review and publication require complete marks'
);
select ok(exists (
  select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
  where c.relname = 'exam_subjects' and t.tgname = 'exam_subjects_guard_workflow' and not t.tgisinternal
), 'exam subjects are guarded by workflow stage');
select ok(exists (
  select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
  where c.relname = 'exam_schedules' and t.tgname = 'exam_schedules_guard_workflow' and not t.tgisinternal
), 'exam schedules are guarded by workflow stage');
select ok(exists (
  select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
  where c.relname = 'marks' and t.tgname = 'marks_guard_workflow' and not t.tgisinternal
), 'marks require the marking stage');
select ok(
  (select prosrc ilike '%active student enrolment in the exam class and session%'
   from pg_proc where oid = 'public.guard_exam_mark_changes()'::regprocedure),
  'marks are restricted to active class enrolments'
);
select ok(exists (
  select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
  where c.relname = 'exams' and t.tgname = 'exams_guard_metadata_workflow' and not t.tgisinternal
), 'exam metadata is frozen after draft');
select ok(exists (
  select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
  where c.relname = 'exams' and t.tgname = 'exams_guard_delete_workflow' and not t.tgisinternal
), 'only draft exams can be deleted directly');
select ok(exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'exam_types' and cmd = 'SELECT'
), 'school members can read exam types');
select ok(exists (
  select 1 from pg_policies
  where schemaname = 'public' and tablename = 'exam_types' and cmd = 'ALL'
), 'exam managers can create and manage exam types');
select ok(exists (
  select 1 from pg_policies
  where schemaname = 'public'
    and tablename = 'teacher_assignments'
    and policyname = 'Authorized users can read teacher assignments'
    and qual ilike '%exams%'
), 'exam viewers can read teacher assignments');
select ok(exists (
  select 1 from pg_policies
  where schemaname = 'public'
    and tablename = 'teacher_assignments'
    and policyname = 'Authorized users can read teacher assignments'
    and qual ilike '%timetable%'
), 'timetable viewers can read teacher assignments');
select ok(
  (select pg_get_constraintdef(oid) ilike '%assignment_type = ''subject''%'
          and pg_get_constraintdef(oid) ilike '%section_id is null%'
   from pg_constraint
   where conrelid = 'public.teacher_assignments'::regclass
     and conname = 'teacher_assignments_check'),
  'subject teacher assignments can be class-wide or class-specific'
);
select ok(
  to_regprocedure('public.complete_hrm_hire_with_subjects(uuid,uuid,text,jsonb,uuid,jsonb)') is not null,
  'teacher hiring can atomically save subject assignments'
);

select * from finish();
rollback;
