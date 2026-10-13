alter table public.hrm_job_openings
  add column if not exists employee_type text not null default 'staff';

alter table public.hrm_job_openings
  drop constraint if exists hrm_job_openings_employee_type_check;

alter table public.hrm_job_openings
  add constraint hrm_job_openings_employee_type_check
  check (employee_type in ('teacher', 'staff'));

alter table public.hrm_candidates
  add column if not exists hired_employee_id uuid,
  add column if not exists hired_employee_type text,
  add column if not exists hired_employee_code text;

update public.hrm_candidates
   set stage = 'offer'
 where stage = 'hired'
   and hired_employee_id is null;

alter table public.hrm_candidates
  drop constraint if exists hrm_candidates_hired_employee_check;

alter table public.hrm_candidates
  add constraint hrm_candidates_hired_employee_check
  check (
    (stage <> 'hired' and hired_employee_id is null and hired_employee_type is null and hired_employee_code is null)
    or (
      stage = 'hired'
      and hired_employee_id is not null
      and hired_employee_type in ('teacher', 'staff')
      and hired_employee_code is not null
    )
  );

create unique index if not exists hrm_candidates_employee_identity_idx
  on public.hrm_candidates (school_id, hired_employee_type, hired_employee_id)
  where hired_employee_id is not null;

create or replace function public.complete_hrm_hire(p_school_id uuid, p_candidate_id uuid)
returns table (employee_id uuid, employee_type text, employee_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate public.hrm_candidates%rowtype;
  v_job public.hrm_job_openings%rowtype;
  v_employee_id uuid;
  v_employee_code text;
  v_name_parts text[];
  v_first_name text;
  v_last_name text;
begin
  if auth.uid() is null
     or not public.has_permission(p_school_id, 'recruitment', 'manage') then
    raise exception 'You do not have permission to complete this hire.';
  end if;

  select *
    into v_candidate
    from public.hrm_candidates
   where id = p_candidate_id
     and school_id = p_school_id
   for update;

  if not found then
    raise exception 'Candidate was not found in this school.';
  end if;

  if v_candidate.stage = 'hired'
     and v_candidate.hired_employee_id is not null then
    return query select v_candidate.hired_employee_id,
      v_candidate.hired_employee_type,
      v_candidate.hired_employee_code;
    return;
  end if;

  if v_candidate.stage <> 'offer' then
    raise exception 'Candidate must be at offer stage before the hire can be completed.';
  end if;
  if v_candidate.job_id is null then
    raise exception 'Candidate must be assigned to a vacancy before the hire can be completed.';
  end if;

  select *
    into v_job
    from public.hrm_job_openings
   where id = v_candidate.job_id
     and school_id = p_school_id;

  if not found then
    raise exception 'Candidate vacancy was not found in this school.';
  end if;
  if v_job.employee_type not in ('teacher', 'staff') then
    raise exception 'Vacancy must have a valid employee record type.';
  end if;
  if not public.has_permission(
    p_school_id,
    case when v_job.employee_type = 'teacher' then 'teachers' else 'staff' end,
    'manage'
  ) then
    raise exception 'You do not have permission to create this employee record.';
  end if;

  v_name_parts := regexp_split_to_array(trim(v_candidate.candidate_name), '\s+');
  v_first_name := v_name_parts[1];
  v_last_name := array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' ');
  if coalesce(v_last_name, '') = '' then
    v_last_name := v_first_name;
  end if;
  v_employee_code := 'EMP-' || to_char(current_date, 'YYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  if v_job.employee_type = 'teacher' then
    insert into public.teachers (
      school_id, employee_code, first_name, last_name, email, phone,
      specialization, joining_date, employment_status, is_active, deleted_at
    )
    values (
      p_school_id, v_employee_code, v_first_name, v_last_name,
      v_candidate.email, v_candidate.phone, v_job.title, current_date,
      'active', true, null
    )
    returning id into v_employee_id;
  else
    insert into public.staff (
      school_id, employee_code, first_name, last_name, designation,
      department, email, phone, joining_date, employment_status, is_active, deleted_at
    )
    values (
      p_school_id, v_employee_code, v_first_name, v_last_name, v_job.title,
      v_job.department, v_candidate.email, v_candidate.phone, current_date,
      'active', true, null
    )
    returning id into v_employee_id;
  end if;

  update public.hrm_candidates
     set stage = 'hired',
         hired_employee_id = v_employee_id,
         hired_employee_type = v_job.employee_type,
         hired_employee_code = v_employee_code
   where id = p_candidate_id
     and school_id = p_school_id;

  return query select v_employee_id, v_job.employee_type, v_employee_code;
end;
$$;

revoke all on function public.complete_hrm_hire(uuid, uuid) from public, anon;
grant execute on function public.complete_hrm_hire(uuid, uuid) to authenticated;
