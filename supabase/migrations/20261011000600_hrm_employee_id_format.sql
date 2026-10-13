do $$
declare
  v_function_definition text;
  v_statement_start integer;
  v_statement_length integer;
  v_existing_statement text;
begin
  select pg_get_functiondef(
    'public.complete_hrm_hire(uuid, uuid, uuid, text, text, text, uuid, text, jsonb)'::regprocedure
  )
    into v_function_definition;

  v_statement_start := position('v_employee_code :=' in v_function_definition);
  if v_statement_start = 0 then
    raise exception 'The expected employee-code generator was not found exactly once.';
  end if;

  v_statement_length := position(';' in substring(v_function_definition from v_statement_start));
  if v_statement_length = 0 then
    raise exception 'The employee-code generator statement is incomplete.';
  end if;
  v_existing_statement := substring(v_function_definition from v_statement_start for v_statement_length);
  if position('v_employee_code := v_application_user_id' in v_existing_statement) > 0 then
    return;
  end if;
  if position('EMP-' in v_existing_statement) = 0
     or position('gen_random_uuid' in v_existing_statement) = 0
     or position(
       'v_employee_code :='
       in substring(v_function_definition from v_statement_start + v_statement_length)
     ) > 0 then
    raise exception 'The expected employee-code generator was not found exactly once.';
  end if;

  execute overlay(
    v_function_definition
    placing 'v_employee_code := v_application_user_id;'
    from v_statement_start
    for v_statement_length
  );
end;
$$;

update public.teachers teacher
   set employee_code = profile.application_user_id
  from public.profiles profile
 where profile.id = teacher.profile_id
   and profile.application_user_id ~ '^[A-Z]{1,16}[0-9]{4}$'
   and teacher.employee_code is distinct from profile.application_user_id;

update public.staff employee
   set employee_code = profile.application_user_id
  from public.profiles profile
 where profile.id = employee.profile_id
   and profile.application_user_id ~ '^[A-Z]{1,16}[0-9]{4}$'
   and employee.employee_code is distinct from profile.application_user_id;

update public.hrm_candidates candidate
   set hired_employee_code = employee.employee_code
  from public.teachers employee
 where candidate.stage = 'hired'
   and candidate.hired_employee_type = 'teacher'
   and candidate.hired_employee_id = employee.id
   and candidate.hired_employee_code is distinct from employee.employee_code;

update public.hrm_candidates candidate
   set hired_employee_code = employee.employee_code
  from public.staff employee
 where candidate.stage = 'hired'
   and candidate.hired_employee_type = 'staff'
   and candidate.hired_employee_id = employee.id
   and candidate.hired_employee_code is distinct from employee.employee_code;
