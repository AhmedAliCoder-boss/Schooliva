alter table public.hrm_employee_terminations
  add column if not exists status text not null default 'approved',
  add column if not exists resignation_file_path text,
  add column if not exists submitted_by uuid references public.profiles (id),
  add column if not exists decision_by uuid references public.profiles (id),
  add column if not exists decision_at timestamptz,
  add column if not exists decision_notes text;

update public.hrm_employee_terminations
   set submitted_by = coalesce(submitted_by, terminated_by),
       decision_by = coalesce(decision_by, terminated_by),
       decision_at = coalesce(decision_at, created_at)
 where submitted_by is null
    or decision_by is null
    or decision_at is null;

alter table public.hrm_employee_terminations
  alter column submitted_by set not null,
  alter column terminated_by drop not null,
  add constraint hrm_employee_terminations_status_check
    check (status in ('pending', 'approved', 'rejected')),
  add constraint hrm_employee_terminations_decision_check
    check (
      (status = 'pending' and decision_by is null and decision_at is null and terminated_by is null)
      or (status = 'rejected' and decision_by is not null and decision_at is not null and terminated_by is null)
      or (status = 'approved' and decision_by is not null and decision_at is not null and terminated_by is not null)
    ),
  add constraint hrm_employee_terminations_file_path_check
    check (resignation_file_path is null or length(trim(resignation_file_path)) between 1 and 500),
  add constraint hrm_employee_terminations_decision_notes_check
    check (decision_notes is null or length(decision_notes) <= 2000);

drop index if exists public.hrm_employee_terminations_teacher_idx;
drop index if exists public.hrm_employee_terminations_staff_idx;

create unique index hrm_employee_terminations_teacher_active_idx
  on public.hrm_employee_terminations (school_id, teacher_id)
  where teacher_id is not null and status in ('pending', 'approved');
create unique index hrm_employee_terminations_staff_active_idx
  on public.hrm_employee_terminations (school_id, staff_id)
  where staff_id is not null and status in ('pending', 'approved');

create or replace function public.can_review_hrm_employee_exit(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_account_active()
    and exists (
      select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
       where ur.user_id = (select auth.uid())
         and ur.school_id = p_school_id
         and r.slug in ('school_admin', 'principal')
    );
$$;

revoke all on function public.can_review_hrm_employee_exit(uuid) from public, anon;
grant execute on function public.can_review_hrm_employee_exit(uuid) to authenticated;

drop policy if exists "HRM managers can view employee terminations"
  on public.hrm_employee_terminations;
create policy "HRM and school leaders can view employee exits"
on public.hrm_employee_terminations for select to authenticated
using (
  public.has_permission(school_id, 'recruitment', 'view')
  or public.has_permission(school_id, 'recruitment', 'manage')
  or public.can_review_hrm_employee_exit(school_id)
  or public.is_super_admin()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-resignations',
  'employee-resignations',
  false,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "HRM managers can upload resignation letters" on storage.objects;
create policy "HRM managers can upload resignation letters"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'employee-resignations'
  and split_part(name, '/', 2) in ('teacher', 'staff')
  and (
    (split_part(name, '/', 2) = 'teacher' and exists (
      select 1 from public.teachers t
       where t.id::text = split_part(name, '/', 3)
         and t.school_id::text = split_part(name, '/', 1)
         and public.has_permission(t.school_id, 'recruitment', 'manage')
    ))
    or (split_part(name, '/', 2) = 'staff' and exists (
      select 1 from public.staff s
       where s.id::text = split_part(name, '/', 3)
         and s.school_id::text = split_part(name, '/', 1)
         and public.has_permission(s.school_id, 'recruitment', 'manage')
    ))
  )
);

drop policy if exists "HRM and school leaders can view resignation letters" on storage.objects;
create policy "HRM and school leaders can view resignation letters"
on storage.objects for select to authenticated
using (
  bucket_id = 'employee-resignations'
  and exists (
    select 1
      from public.hrm_employee_terminations t
     where t.resignation_file_path = name
       and (
         public.has_permission(t.school_id, 'recruitment', 'view')
         or public.has_permission(t.school_id, 'recruitment', 'manage')
         or public.can_review_hrm_employee_exit(t.school_id)
         or public.is_super_admin()
       )
  )
);

drop policy if exists "HRM managers can clean up unlinked resignation letters" on storage.objects;
create policy "HRM managers can clean up unlinked resignation letters"
on storage.objects for delete to authenticated
using (
  bucket_id = 'employee-resignations'
  and split_part(name, '/', 2) in ('teacher', 'staff')
  and (
    (split_part(name, '/', 2) = 'teacher' and exists (
      select 1 from public.teachers t
       where t.id::text = split_part(name, '/', 3)
         and t.school_id::text = split_part(name, '/', 1)
         and public.has_permission(t.school_id, 'recruitment', 'manage')
    ))
    or (split_part(name, '/', 2) = 'staff' and exists (
      select 1 from public.staff s
       where s.id::text = split_part(name, '/', 3)
         and s.school_id::text = split_part(name, '/', 1)
         and public.has_permission(s.school_id, 'recruitment', 'manage')
    ))
  )
);

drop function if exists public.terminate_hrm_employee(uuid, text, uuid, date, text, text);

create or replace function public.submit_hrm_employee_exit(
  p_school_id uuid,
  p_employee_type text,
  p_employee_id uuid,
  p_terminated_on date,
  p_reason text,
  p_notes text,
  p_resignation_file_path text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_status text;
  v_termination_id uuid;
  v_employee_resource text;
  v_expected_file_prefix text;
begin
  if auth.uid() is null
     or not public.is_account_active()
     or not public.has_permission(p_school_id, 'recruitment', 'manage') then
    raise exception 'You do not have permission to submit employee exit requests.';
  end if;

  if p_employee_type is null
     or p_employee_type not in ('teacher', 'staff')
     or p_employee_id is null
     or p_terminated_on is null
     or p_terminated_on > current_date
     or length(trim(coalesce(p_reason, ''))) not between 3 and 500
     or length(coalesce(p_notes, '')) > 2000 then
    raise exception 'Employee exit request details are invalid.';
  end if;

  v_employee_resource := case when p_employee_type = 'teacher' then 'teachers' else 'staff' end;
  if not public.has_permission(p_school_id, v_employee_resource, 'manage') then
    raise exception 'You do not have permission to manage this employee type.';
  end if;

  v_expected_file_prefix := p_school_id::text || '/' || p_employee_type || '/' || p_employee_id::text || '/';
  if p_resignation_file_path is null
     or left(p_resignation_file_path, length(v_expected_file_prefix)) <> v_expected_file_prefix
     or not exists (
       select 1 from storage.objects o
        where o.bucket_id = 'employee-resignations'
          and o.name = p_resignation_file_path
          and o.owner_id = auth.uid()::text
     )
     or exists (
       select 1 from public.hrm_employee_terminations t
        where t.resignation_file_path = p_resignation_file_path
     ) then
    raise exception 'A valid resignation letter must be uploaded before submission.';
  end if;

  if p_employee_type = 'teacher' then
    select employment_status into v_employee_status
      from public.teachers
     where school_id = p_school_id and id = p_employee_id
     for update;
  else
    select employment_status into v_employee_status
      from public.staff
     where school_id = p_school_id and id = p_employee_id
     for update;
  end if;

  if not found then
    raise exception 'Employee was not found in this school.';
  end if;
  if v_employee_status = 'terminated' then
    raise exception 'This employee is already terminated.';
  end if;

  insert into public.hrm_employee_terminations (
    school_id, employee_type, teacher_id, staff_id, terminated_on, reason, notes,
    terminated_by, submitted_by, resignation_file_path, status
  )
  values (
    p_school_id, p_employee_type,
    case when p_employee_type = 'teacher' then p_employee_id else null end,
    case when p_employee_type = 'staff' then p_employee_id else null end,
    p_terminated_on, trim(p_reason), nullif(trim(coalesce(p_notes, '')), ''),
    null, auth.uid(), p_resignation_file_path, 'pending'
  )
  returning id into v_termination_id;

  return v_termination_id;
end;
$$;

revoke all on function public.submit_hrm_employee_exit(uuid, text, uuid, date, text, text, text) from public, anon;
grant execute on function public.submit_hrm_employee_exit(uuid, text, uuid, date, text, text, text) to authenticated;

create or replace function public.review_hrm_employee_exit(
  p_request_id uuid,
  p_decision text,
  p_decision_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.hrm_employee_terminations%rowtype;
  v_profile_id uuid;
  v_employee_status text;
begin
  if auth.uid() is null or not public.is_account_active() then
    raise exception 'An active signed-in account is required to review employee exits.';
  end if;

  if p_decision is null
     or p_decision not in ('approved', 'rejected')
     or length(coalesce(p_decision_notes, '')) > 2000 then
    raise exception 'Employee exit decision is invalid.';
  end if;

  select * into v_request
    from public.hrm_employee_terminations
   where id = p_request_id
   for update;
  if not found then
    raise exception 'Employee exit request was not found.';
  end if;
  if not public.can_review_hrm_employee_exit(v_request.school_id) then
    raise exception 'Only a School Admin or Principal can decide this request.';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This employee exit request has already been reviewed.';
  end if;

  if p_decision = 'approved' then
    if v_request.employee_type = 'teacher' then
      select profile_id, employment_status
        into v_profile_id, v_employee_status
        from public.teachers
       where school_id = v_request.school_id and id = v_request.teacher_id
       for update;
    else
      select profile_id, employment_status
        into v_profile_id, v_employee_status
        from public.staff
       where school_id = v_request.school_id and id = v_request.staff_id
       for update;
    end if;

    if not found or v_employee_status = 'terminated' then
      raise exception 'Employee is missing or already terminated.';
    end if;

    if v_request.employee_type = 'teacher' then
      update public.teachers
         set employment_status = 'terminated',
             is_active = false,
             deleted_at = coalesce(deleted_at, v_request.terminated_on::timestamp at time zone 'UTC')
       where school_id = v_request.school_id and id = v_request.teacher_id;
    else
      update public.staff
         set employment_status = 'terminated',
             is_active = false,
             deleted_at = coalesce(deleted_at, v_request.terminated_on::timestamp at time zone 'UTC')
       where school_id = v_request.school_id and id = v_request.staff_id;
    end if;

    if v_profile_id is not null then
      delete from public.user_roles
       where school_id = v_request.school_id and user_id = v_profile_id;
    end if;
  end if;

  update public.hrm_employee_terminations
     set status = p_decision,
         decision_by = auth.uid(),
         decision_at = timezone('utc', now()),
         decision_notes = nullif(trim(coalesce(p_decision_notes, '')), ''),
         terminated_by = case when p_decision = 'approved' then auth.uid() else null end
   where id = p_request_id;

  return p_request_id;
end;
$$;

revoke all on function public.review_hrm_employee_exit(uuid, text, text) from public, anon;
grant execute on function public.review_hrm_employee_exit(uuid, text, text) to authenticated;
