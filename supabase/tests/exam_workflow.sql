begin;

select plan(19);

select ok(
  (select prosrc ilike '%Overall exam status must match progress across every active section%'
   from pg_proc where oid = 'public.enforce_exam_workflow()'::regprocedure),
  'overall exam status reflects every active section'
);
select ok(
  (select prosrc ilike '%Enter marks for every enrolled student in this section before review%'
   from pg_proc where oid = 'public.transition_exam_section_workflow(uuid,uuid,uuid,text)'::regprocedure),
  'section review requires complete marks for that section'
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
  (select prosrc ilike '%active enrolment in a section submitted for marking%'
   from pg_proc where oid = 'public.guard_exam_mark_changes()'::regprocedure),
  'marks are restricted to students in sections submitted for marking'
);
select ok(
  (select prosrc ilike '%v_exam_id%'
          and prosrc not ilike '%w.exam_id = exam_id%'
   from pg_proc where oid = 'public.guard_exam_mark_changes()'::regprocedure),
  'mark guard variables are unambiguous in workflow checks'
);
select ok(
  (select count(*) = 2
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'published_exam_results'
     and column_name in ('student_identifier', 'passing_marks')),
  'published results expose student identity and pass marks for report cards'
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
select ok(
  to_regclass('public.exam_section_workflows') is not null,
  'exam workflow progress is tracked independently per section'
);
select ok(
  (select prosrc ilike '%Schedule every exam subject for this section%'
   from pg_proc where oid = 'public.transition_exam_section_workflow(uuid,uuid,uuid,text)'::regprocedure),
  'a section must have all its papers scheduled before marking submission'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'exam_section_workflows'
      and cmd = 'SELECT'
  ),
  'authorized exam and grading users can read section workflow progress'
);

select * from finish();
rollback;
