do $$
declare
  v_function_definition text;
  v_ambiguous_employee_code_check text := $check$
    exit when not exists (
      select 1
        from public.teachers
       where school_id = p_school_id and lower(employee_code) = lower(v_employee_code)
      union all
      select 1
        from public.staff
       where school_id = p_school_id and lower(employee_code) = lower(v_employee_code)
    );
$check$;
  v_qualified_employee_code_check text := $check$
    exit when not exists (
      select 1
        from public.teachers as teacher
       where teacher.school_id = p_school_id and lower(teacher.employee_code) = lower(v_employee_code)
      union all
      select 1
        from public.staff as employee
       where employee.school_id = p_school_id and lower(employee.employee_code) = lower(v_employee_code)
    );
$check$;
begin
  select pg_get_functiondef(
    'public.complete_hrm_hire(uuid, uuid, text, jsonb)'::regprocedure
  )
    into v_function_definition;

  if position(v_qualified_employee_code_check in v_function_definition) > 0 then
    return;
  end if;
  if position(v_ambiguous_employee_code_check in v_function_definition) = 0 then
    raise exception 'The expected employee-code collision check was not found in complete_hrm_hire.';
  end if;

  execute replace(
    v_function_definition,
    v_ambiguous_employee_code_check,
    v_qualified_employee_code_check
  );
end;
$$;
