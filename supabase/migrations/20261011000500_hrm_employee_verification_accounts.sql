alter table public.teachers
  add column if not exists photo_path text;

alter table public.staff
  add column if not exists photo_path text;

alter table public.hrm_candidates
  add column if not exists hired_application_user_id text;

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
      and hired_application_user_id is not null
    )
  ) NOT VALID;

create unique index if not exists teachers_school_profile_key
  on public.teachers (school_id, profile_id)
  where profile_id is not null;

create unique index if not exists staff_school_profile_key
  on public.staff (school_id, profile_id)
  where profile_id is not null;

create table if not exists public.hrm_user_id_sequences (
  prefix text primary key,
  next_value integer not null check (next_value between 1 and 10000)
);

create table if not exists public.hrm_employee_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  employee_type text not null check (employee_type in ('teacher', 'staff')),
  employee_id uuid not null,
  document_type text not null check (
    document_type in ('national_id', 'qualification', 'experience', 'police_verification')
  ),
  storage_path text not null unique,
  original_name text not null,
  content_type text not null check (
    content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  file_size integer not null check (file_size > 0 and file_size <= 5242880),
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  check (length(trim(original_name)) > 0)
);

create index if not exists hrm_employee_documents_employee_idx
  on public.hrm_employee_documents (school_id, employee_type, employee_id, document_type);

alter table public.hrm_employee_documents enable row level security;

drop policy if exists "School employees can view their verification documents"
  on public.hrm_employee_documents;
create policy "School employees can view their verification documents"
on public.hrm_employee_documents for select to authenticated
using (
  (employee_type = 'teacher' and public.has_permission(school_id, 'teachers', 'view'))
  or (employee_type = 'staff' and public.has_permission(school_id, 'staff', 'view'))
  or public.is_super_admin()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-verification',
  'employee-verification',
  false,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "HRM managers can view employee verification files" on storage.objects;
drop policy if exists "HRM managers can upload employee verification files" on storage.objects;
drop policy if exists "HRM managers can update employee verification files" on storage.objects;
drop policy if exists "HRM managers can delete employee verification files" on storage.objects;

drop function if exists public.complete_hrm_hire(uuid, uuid);

create or replace function public.complete_hrm_hire(
  p_school_id uuid,
  p_candidate_id uuid,
  p_account_user_id uuid,
  p_hire_token text,
  p_username text,
  p_account_email text,
  p_additional_role_id uuid,
  p_photo_path text,
  p_documents jsonb
)
returns table (
  employee_id uuid,
  employee_type text,
  employee_code text,
  application_user_id text
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
  v_application_user_id text;
  v_prefix text;
  v_name_parts text[];
  v_first_name text;
  v_last_name text;
  v_base_role_id uuid;
  v_additional_role_slug text;
  v_counter integer;
  v_user_auth_metadata jsonb;
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
    raise exception 'Only a Principal, School Admin, or Master Admin can create employee accounts.';
  end if;

  if p_account_user_id is null
     or nullif(trim(p_username), '') is null
     or p_username !~ '^[A-Za-z0-9._-]{3,30}$'
     or nullif(trim(p_hire_token), '') is null
     or p_photo_path is null
     or p_documents is null
     or jsonb_typeof(p_documents) <> 'array'
     or not (p_documents @> '[{"document_type":"national_id"}]'::jsonb)
     or not (p_documents @> '[{"document_type":"qualification"}]'::jsonb) then
    raise exception 'Employee photo, national ID, qualification documents, and login details are required.';
  end if;

  select raw_app_meta_data
    into v_user_auth_metadata
    from auth.users
   where id = p_account_user_id;
  if not found
     or v_user_auth_metadata ->> 'hrm_hire_token' is distinct from p_hire_token
     or v_user_auth_metadata ->> 'hrm_hire_candidate_id' is distinct from p_candidate_id::text
     or v_user_auth_metadata ->> 'hrm_hire_school_id' is distinct from p_school_id::text then
    raise exception 'The employee login account is not valid for this hire.';
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

  if v_candidate.stage = 'hired' and v_candidate.hired_employee_id is not null then
    raise exception 'Candidate hire has already been completed.';
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
      raise exception 'The school User ID sequence is full. Contact support.';
    end if;
    v_application_user_id := v_prefix || lpad(v_counter::text, 4, '0');
    exit when not exists (
      select 1 from public.profiles
       where lower(application_user_id) = lower(v_application_user_id)
    );
    insert into public.hrm_user_id_sequences (prefix, next_value)
    values (v_prefix, v_counter + 2)
    on conflict (prefix) do update
      set next_value = greatest(public.hrm_user_id_sequences.next_value, v_counter + 2);
    v_counter := v_counter + 1;
  end loop;

  select id into v_base_role_id
    from public.roles
   where school_id is null
     and slug = v_job.employee_type
   limit 1;
  if v_base_role_id is null then
    raise exception 'The employee role is not configured.';
  end if;

  if p_additional_role_id is not null then
    select slug into v_additional_role_slug
      from public.roles
     where id = p_additional_role_id
       and (school_id is null or school_id = p_school_id);
    if not found or v_additional_role_slug in ('super_admin', 'master_admin', 'student', 'parent') then
      raise exception 'Choose an allowed additional school role.';
    end if;
  end if;

  v_name_parts := regexp_split_to_array(trim(v_candidate.candidate_name), '\s+');
  v_first_name := v_name_parts[1];
  v_last_name := array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' ');
  if coalesce(v_last_name, '') = '' then
    v_last_name := v_first_name;
  end if;
  v_employee_code := 'EMP-' || to_char(current_date, 'YYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  update public.profiles
     set application_user_id = v_application_user_id,
         username = trim(p_username),
         first_name = v_first_name,
         last_name = v_last_name,
         full_name = trim(v_candidate.candidate_name),
         email = nullif(trim(p_account_email), ''),
         account_status = 'active',
         is_active = true,
         avatar_path = p_photo_path
   where id = p_account_user_id;
  if not found then
    raise exception 'Employee login account was not created correctly.';
  end if;

  insert into public.user_roles (user_id, school_id, role_id)
  values (p_account_user_id, p_school_id, v_base_role_id);
  if p_additional_role_id is not null and p_additional_role_id <> v_base_role_id then
    insert into public.user_roles (user_id, school_id, role_id)
    values (p_account_user_id, p_school_id, p_additional_role_id);
  end if;

  if v_job.employee_type = 'teacher' then
    insert into public.teachers (
      school_id, profile_id, employee_code, first_name, last_name, email, phone,
      specialization, joining_date, employment_status, is_active, deleted_at, photo_path
    )
    values (
      p_school_id, p_account_user_id, v_employee_code, v_first_name, v_last_name,
      nullif(trim(p_account_email), ''), v_candidate.phone, v_job.title, current_date,
      'active', true, null, p_photo_path
    )
    returning id into v_employee_id;
  else
    insert into public.staff (
      school_id, profile_id, employee_code, first_name, last_name, designation,
      department, email, phone, joining_date, employment_status, is_active, deleted_at, photo_path
    )
    values (
      p_school_id, p_account_user_id, v_employee_code, v_first_name, v_last_name, v_job.title,
      v_job.department, nullif(trim(p_account_email), ''), v_candidate.phone, current_date,
      'active', true, null, p_photo_path
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
         hired_application_user_id = v_application_user_id
   where id = p_candidate_id
     and school_id = p_school_id;

  return query select v_employee_id, v_job.employee_type, v_employee_code, v_application_user_id;
end;
$$;

revoke all on function public.complete_hrm_hire(uuid, uuid, uuid, text, text, text, uuid, text, jsonb)
  from public, anon;
grant execute on function public.complete_hrm_hire(uuid, uuid, uuid, text, text, text, uuid, text, jsonb)
  to authenticated;
