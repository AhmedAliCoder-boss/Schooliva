alter table public.hrm_candidates
  drop constraint if exists hrm_candidates_hired_employee_check;

alter table public.hrm_candidates
  add constraint hrm_candidates_hired_employee_check
  check (
    (stage <> 'hired' and hired_employee_id is null and hired_employee_type is null
      and hired_employee_code is null and hired_application_user_id is null)
    or (
      stage = 'hired'
      and hired_employee_id is not null
      and hired_employee_type in ('teacher', 'staff')
      and hired_employee_code is not null
    )
  ) NOT VALID;

create table if not exists public.hrm_account_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  employee_type text not null check (employee_type in ('teacher', 'staff')),
  employee_id uuid not null,
  employee_code text not null,
  requested_by uuid not null references public.profiles (id),
  requested_role_id uuid not null references public.roles (id),
  email text not null check (length(trim(email)) between 3 and 254),
  username text not null check (username ~ '^[A-Za-z0-9._-]{3,30}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  account_user_id uuid references public.profiles (id) on delete set null,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  check (email = trim(email))
);

create unique index if not exists hrm_account_requests_one_pending_employee
  on public.hrm_account_requests (school_id, employee_type, employee_id)
  where status = 'pending';
create index if not exists hrm_account_requests_status_created_idx
  on public.hrm_account_requests (status, created_at desc);

alter table public.hrm_account_requests enable row level security;
grant select on table public.hrm_account_requests to authenticated;
grant all on table public.hrm_account_requests to service_role;

drop policy if exists "School HRM managers and platform admins can read account requests"
  on public.hrm_account_requests;
create policy "School HRM managers and platform admins can read account requests"
on public.hrm_account_requests for select to authenticated
using (
  public.is_super_admin()
  or public.has_permission(school_id, 'recruitment', 'manage')
);

revoke insert, update, delete on public.hrm_account_requests from public, anon, authenticated;

drop function if exists public.complete_hrm_hire(uuid, uuid, uuid, text, text, text, uuid, text, jsonb);
drop function if exists public.complete_hrm_hire(uuid, uuid, text, jsonb);

create function public.complete_hrm_hire(
  p_school_id uuid,
  p_candidate_id uuid,
  p_photo_path text,
  p_documents jsonb
)
returns table (
  employee_id uuid,
  employee_type text,
  employee_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate public.hrm_candidates%rowtype;
  v_job public.hrm_job_openings%rowtype;
  v_school public.schools%rowtype;
  v_employee_id uuid;
  v_employee_code text;
  v_prefix text;
  v_name_parts text[];
  v_first_name text;
  v_last_name text;
  v_counter integer;
begin
  if auth.uid() is null
     or not public.has_permission(p_school_id, 'recruitment', 'manage') then
    raise exception 'You do not have permission to complete this hire.';
  end if;

  if not (
    public.is_super_admin()
    or exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and ur.school_id = p_school_id
        and r.slug in ('school_admin', 'principal')
    )
  ) then
    raise exception 'Only a Principal, School Admin, or Master Admin can complete this hire.';
  end if;

  if p_photo_path is null
     or p_documents is null
     or jsonb_typeof(p_documents) <> 'array'
     or not (p_documents @> '[{"document_type":"national_id"}]'::jsonb)
     or not (p_documents @> '[{"document_type":"qualification"}]'::jsonb) then
    raise exception 'Employee photo, national ID, and qualification documents are required.';
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
  if v_candidate.stage = 'hired' then
    raise exception 'Candidate hire has already been completed.';
  end if;
  if v_candidate.stage <> 'offer' or v_candidate.job_id is null then
    raise exception 'Candidate must be assigned to a vacancy and at offer stage.';
  end if;

  select *
    into v_job
    from public.hrm_job_openings
   where id = v_candidate.job_id
     and school_id = p_school_id;
  if not found or v_job.employee_type not in ('teacher', 'staff') then
    raise exception 'Candidate vacancy was not found or has an invalid employee type.';
  end if;
  if not public.has_permission(
    p_school_id,
    case when v_job.employee_type = 'teacher' then 'teachers' else 'staff' end,
    'manage'
  ) then
    raise exception 'You do not have permission to create this employee record.';
  end if;

  select *
    into v_school
    from public.schools
   where id = p_school_id;
  if not found then
    raise exception 'School was not found.';
  end if;

  v_prefix := upper(left(coalesce((
    select string_agg(left(regexp_replace(word, '[^A-Za-z0-9]', '', 'g'), 1), '')
      from regexp_split_to_table(trim(v_school.name), '\s+') as word
     where regexp_replace(word, '[^A-Za-z0-9]', '', 'g') <> ''
  ), 'SCH'), 16));
  if v_prefix = '' then
    v_prefix := 'SCH';
  end if;

  insert into public.hrm_user_id_sequences (prefix, next_value)
  values (v_prefix, 2)
  on conflict (prefix) do update
    set next_value = public.hrm_user_id_sequences.next_value + 1
  returning next_value - 1 into v_counter;

  loop
    if v_counter > 9999 then
      raise exception 'The school Employee ID sequence is full. Contact support.';
    end if;
    v_employee_code := v_prefix || lpad(v_counter::text, 4, '0');
    exit when not exists (
      select 1
        from public.teachers
       where school_id = p_school_id and lower(employee_code) = lower(v_employee_code)
      union all
      select 1
        from public.staff
       where school_id = p_school_id and lower(employee_code) = lower(v_employee_code)
    );
    insert into public.hrm_user_id_sequences (prefix, next_value)
    values (v_prefix, v_counter + 2)
    on conflict (prefix) do update
      set next_value = greatest(public.hrm_user_id_sequences.next_value, v_counter + 2);
    v_counter := v_counter + 1;
  end loop;

  v_name_parts := regexp_split_to_array(trim(v_candidate.candidate_name), '\s+');
  v_first_name := v_name_parts[1];
  v_last_name := array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' ');
  if coalesce(v_last_name, '') = '' then
    v_last_name := v_first_name;
  end if;

  if v_job.employee_type = 'teacher' then
    insert into public.teachers (
      school_id, employee_code, first_name, last_name, email, phone,
      specialization, joining_date, employment_status, is_active, deleted_at, photo_path
    )
    values (
      p_school_id, v_employee_code, v_first_name, v_last_name, v_candidate.email, v_candidate.phone,
      v_job.title, current_date, 'active', true, null, p_photo_path
    )
    returning id into v_employee_id;
  else
    insert into public.staff (
      school_id, employee_code, first_name, last_name, designation,
      department, email, phone, joining_date, employment_status, is_active, deleted_at, photo_path
    )
    values (
      p_school_id, v_employee_code, v_first_name, v_last_name, v_job.title,
      v_job.department, v_candidate.email, v_candidate.phone, current_date, 'active', true, null, p_photo_path
    )
    returning id into v_employee_id;
  end if;

  insert into public.hrm_employee_documents (
    school_id, employee_type, employee_id, document_type, storage_path,
    original_name, content_type, file_size, uploaded_by
  )
  select p_school_id, v_job.employee_type, v_employee_id, upload.document_type,
         upload.storage_path, upload.original_name, upload.content_type, upload.file_size, auth.uid()
    from jsonb_to_recordset(p_documents)
      as upload(document_type text, storage_path text, original_name text, content_type text, file_size integer);

  update public.hrm_candidates
     set stage = 'hired',
         hired_employee_id = v_employee_id,
         hired_employee_type = v_job.employee_type,
         hired_employee_code = v_employee_code,
         hired_application_user_id = null
   where id = p_candidate_id
     and school_id = p_school_id;

  return query select v_employee_id, v_job.employee_type, v_employee_code;
end;
$$;

create or replace function public.request_hrm_employee_account(
  p_school_id uuid,
  p_employee_type text,
  p_employee_id uuid,
  p_email text,
  p_username text,
  p_role_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_code text;
  v_profile_id uuid;
  v_role_slug text;
  v_request_id uuid;
begin
  if auth.uid() is null
     or not public.is_account_active()
     or not public.has_permission(p_school_id, 'recruitment', 'manage')
     or not exists (
       select 1 from public.user_roles ur
       join public.roles r on r.id = ur.role_id
       where ur.user_id = auth.uid()
         and ur.school_id = p_school_id
         and r.slug in ('school_admin', 'principal')
     ) then
    raise exception 'Only this school''s School Admin or Principal can request an employee account.';
  end if;

  if p_employee_type is null
     or p_employee_type not in ('teacher', 'staff')
     or nullif(trim(p_email), '') is null
     or trim(p_email) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
     or p_username is null
     or trim(p_username) !~ '^[A-Za-z0-9._-]{3,30}$' then
    raise exception 'Enter a valid employee type, email, and username.';
  end if;

  if p_employee_type = 'teacher' then
    select employee_code, profile_id into v_employee_code, v_profile_id
      from public.teachers where id = p_employee_id and school_id = p_school_id;
  else
    select employee_code, profile_id into v_employee_code, v_profile_id
      from public.staff where id = p_employee_id and school_id = p_school_id;
  end if;
  if not found then
    raise exception 'Employee was not found in this school.';
  end if;
  if v_profile_id is not null then
    raise exception 'This employee already has a login account.';
  end if;
  if not exists (
    select 1 from public.hrm_candidates candidate
     where candidate.school_id = p_school_id
       and candidate.stage = 'hired'
       and candidate.hired_employee_id = p_employee_id
       and candidate.hired_employee_type = p_employee_type
  ) then
    raise exception 'Only employees hired through HRM can request an account.';
  end if;

  select slug into v_role_slug
    from public.roles
   where id = p_role_id
     and (school_id is null or school_id = p_school_id);
  if not found or v_role_slug not in ('teacher', 'staff', 'accountant', 'hr_manager', 'librarian', 'transport_manager') then
    raise exception 'Requested account role is not permitted.';
  end if;
  if p_employee_type = 'teacher' and v_role_slug <> 'teacher' then
    raise exception 'Teacher employee records can only request the Teacher role.';
  end if;

  insert into public.hrm_account_requests (
    school_id, employee_type, employee_id, employee_code, requested_by,
    requested_role_id, email, username
  )
  values (
    p_school_id, p_employee_type, p_employee_id, v_employee_code, auth.uid(),
    p_role_id, trim(p_email), trim(p_username)
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

create or replace function public.resolve_hrm_employee_account_request(
  p_request_id uuid,
  p_approve boolean,
  p_account_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.hrm_account_requests%rowtype;
  v_role_slug text;
  v_employee_code text;
  v_first_name text;
  v_last_name text;
begin
  if auth.uid() is null or not public.is_super_admin() or not public.is_account_active() then
    raise exception 'Only an active Master Admin can resolve employee account requests.';
  end if;

  select * into v_request
    from public.hrm_account_requests
   where id = p_request_id
   for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'Pending account request was not found.';
  end if;

  if not p_approve then
    if p_account_user_id is not null then
      raise exception 'An account ID cannot be provided when rejecting a request.';
    end if;
    update public.hrm_account_requests
       set status = 'rejected', resolved_by = auth.uid(), resolved_at = timezone('utc', now())
     where id = p_request_id;
    return;
  end if;

  if p_account_user_id is null then
    raise exception 'The invited Auth account is required for approval.';
  end if;
  select slug into v_role_slug
    from public.roles
   where id = v_request.requested_role_id
     and (school_id is null or school_id = v_request.school_id);
  if not found or v_role_slug not in ('teacher', 'staff', 'accountant', 'hr_manager', 'librarian', 'transport_manager') then
    raise exception 'Requested account role is no longer permitted.';
  end if;
  if v_request.employee_type = 'teacher' and v_role_slug <> 'teacher' then
    raise exception 'Teacher employee records can only receive the Teacher role.';
  end if;

  perform 1
    from public.profiles
   where id = p_account_user_id
     and lower(email) = lower(v_request.email);
  if not found then
    raise exception 'Invited Auth profile was not created with the requested email.';
  end if;

  if v_request.employee_type = 'teacher' then
    update public.teachers
       set profile_id = p_account_user_id, email = v_request.email
     where id = v_request.employee_id
       and school_id = v_request.school_id
       and profile_id is null
    returning employee_code into v_employee_code;
  else
    update public.staff
       set profile_id = p_account_user_id, email = v_request.email
     where id = v_request.employee_id
       and school_id = v_request.school_id
       and profile_id is null
    returning employee_code into v_employee_code;
  end if;
  if not found or v_employee_code is distinct from v_request.employee_code then
    raise exception 'Employee record is already linked or no longer matches this request.';
  end if;

  if v_request.employee_type = 'teacher' then
    select first_name, last_name into v_first_name, v_last_name
      from public.teachers where id = v_request.employee_id;
  else
    select first_name, last_name into v_first_name, v_last_name
      from public.staff where id = v_request.employee_id;
  end if;

  update public.profiles
     set application_user_id = v_employee_code,
         username = v_request.username,
         first_name = v_first_name,
         last_name = v_last_name,
         full_name = trim(concat_ws(' ', v_first_name, v_last_name)),
         email = v_request.email,
         account_status = 'active',
         is_active = true
   where id = p_account_user_id;
  if not found then
    raise exception 'Auth profile could not be updated.';
  end if;

  insert into public.user_roles (user_id, school_id, role_id)
  values (p_account_user_id, v_request.school_id, v_request.requested_role_id);

  update public.hrm_candidates
     set hired_application_user_id = v_employee_code
   where school_id = v_request.school_id
     and hired_employee_id = v_request.employee_id
     and hired_employee_type = v_request.employee_type;

  update public.hrm_account_requests
     set status = 'approved', account_user_id = p_account_user_id,
         resolved_by = auth.uid(), resolved_at = timezone('utc', now())
   where id = p_request_id;

  insert into public.account_audit_logs (actor_id, target_user_id, school_id, action, result, metadata)
  values (
    auth.uid(), p_account_user_id, v_request.school_id,
    'hrm_account_request_approved', 'success',
    jsonb_build_object('request_id', p_request_id, 'employee_code', v_employee_code, 'role_id', v_request.requested_role_id)
  );
end;
$$;

create or replace function public.create_managed_account(
  target_school_id uuid,
  target_user_id uuid,
  target_application_user_id text,
  target_username text,
  target_first_name text,
  target_last_name text,
  target_full_name text,
  target_phone text,
  target_role_id uuid,
  target_account_status text default 'active'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_slug text;
  v_is_master_admin boolean;
begin
  v_is_master_admin := public.is_super_admin();
  if auth.uid() is null
     or not public.is_account_active()
     or target_school_id is null
     or not (
       v_is_master_admin
       or (
         public.has_permission(target_school_id, 'users', 'manage')
         and exists (
           select 1
             from public.user_roles ur
             join public.roles actor_role on actor_role.id = ur.role_id
            where ur.user_id = auth.uid()
              and ur.school_id = target_school_id
              and actor_role.slug = 'school_admin'
         )
       )
     ) then
    raise exception 'Not authorized to create accounts in this school';
  end if;

  if target_application_user_id is null
     or target_application_user_id !~ '^[A-Za-z0-9._-]{3,40}$' then
    raise exception 'User ID must be 3-40 letters, numbers, dots, dashes, or underscores';
  end if;

  if target_username is null
     or target_username !~ '^[A-Za-z0-9._-]{3,30}$' then
    raise exception 'Username must be 3-30 letters, numbers, dots, dashes, or underscores';
  end if;

  if target_full_name is null or length(trim(target_full_name)) not between 2 and 120 then
    raise exception 'Full name must be between 2 and 120 characters';
  end if;

  if target_account_status is null or target_account_status not in ('active', 'inactive', 'suspended') then
    raise exception 'Invalid account status';
  end if;

  if not exists (
    select 1 from public.profiles where id = target_user_id
  ) then
    raise exception 'Supabase Auth profile was not created';
  end if;

  select slug into v_role_slug
    from public.roles
   where id = target_role_id
     and (school_id is null or school_id = target_school_id);
  if not found or v_role_slug in ('super_admin', 'master_admin') then
    raise exception 'Selected role is not available for this school';
  end if;
  if not v_is_master_admin
     and v_role_slug not in ('teacher', 'accountant', 'hr_manager', 'librarian', 'transport_manager', 'staff') then
    raise exception 'School Admins can only create lower-level school accounts';
  end if;

  update public.profiles
     set application_user_id = trim(target_application_user_id),
         username = trim(target_username),
         first_name = nullif(trim(target_first_name), ''),
         last_name = nullif(trim(target_last_name), ''),
         full_name = trim(target_full_name),
         phone = nullif(trim(coalesce(target_phone, '')), ''),
         account_status = target_account_status
   where id = target_user_id;

  insert into public.user_roles (user_id, school_id, role_id)
  values (target_user_id, target_school_id, target_role_id);

  insert into public.account_audit_logs (actor_id, target_user_id, school_id, action, result, metadata)
  values (
    auth.uid(),
    target_user_id,
    target_school_id,
    'account_created',
    'success',
    jsonb_build_object('role_id', target_role_id, 'status', target_account_status)
  );
end;
$$;

alter table public.hrm_candidates validate constraint hrm_candidates_hired_employee_check;

revoke all on function public.complete_hrm_hire(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.complete_hrm_hire(uuid, uuid, text, jsonb) to authenticated;
revoke all on function public.request_hrm_employee_account(uuid, text, uuid, text, text, uuid) from public, anon;
grant execute on function public.request_hrm_employee_account(uuid, text, uuid, text, text, uuid) to authenticated;
revoke all on function public.resolve_hrm_employee_account_request(uuid, boolean, uuid) from public, anon;
grant execute on function public.resolve_hrm_employee_account_request(uuid, boolean, uuid) to authenticated;
revoke all on function public.create_managed_account(uuid, uuid, text, text, text, text, text, text, uuid, text) from public, anon;
grant execute on function public.create_managed_account(uuid, uuid, text, text, text, text, text, text, uuid, text) to authenticated;
