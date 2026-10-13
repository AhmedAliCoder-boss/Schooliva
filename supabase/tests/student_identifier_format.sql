begin;

select plan(4);

select ok(
  (select prosrc ilike '%class_grade % 100 between 11 and 13 then ''th''%'
          and prosrc ilike '%return school_code || class_token || section_token || lpad(student_number::text, 4, ''0'')%'
   from pg_proc
   where oid = 'public.build_student_identifier(uuid)'::regprocedure),
  'student IDs use school, ordinal class, section, and a four-digit school-wide number'
);

select ok(
  not has_function_privilege('anon', 'public.build_student_identifier(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.build_student_identifier(uuid)', 'EXECUTE'),
  'the identifier helper is not exposed to application roles'
);

select ok(
  exists (
    select 1
    from pg_trigger trigger
    join pg_class table_record on table_record.oid = trigger.tgrelid
    where table_record.relname = 'student_enrollments'
      and trigger.tgname = 'student_enrollments_refresh_student_identifier'
      and not trigger.tgisinternal
  ),
  'enrollment changes refresh the class and section in student IDs'
);

select ok(
  not exists (
    select 1
    from public.students student
    where student.student_identifier is distinct from public.build_student_identifier(student.id)
  ),
  'existing student IDs match their current active enrollment'
);

select * from finish();
rollback;
