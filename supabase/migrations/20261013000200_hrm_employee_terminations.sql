create table public.hrm_employee_terminations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  employee_type text not null check (employee_type in ('teacher', 'staff')),
  teacher_id uuid,
  staff_id uuid,
  terminated_on date not null,
  reason text not null check (length(trim(reason)) between 3 and 500),
  notes text check (notes is null or length(notes) <= 2000),
  terminated_by uuid not null references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, teacher_id) references public.teachers (school_id, id) on delete restrict,
  foreign key (school_id, staff_id) references public.staff (school_id, id) on delete restrict,
  check (
    (employee_type = 'teacher' and teacher_id is not null and staff_id is null)
    or (employee_type = 'staff' and staff_id is not null and teacher_id is null)
  )
);

create unique index hrm_employee_terminations_teacher_idx
  on public.hrm_employee_terminations (school_id, teacher_id)
  where teacher_id is not null;
create unique index hrm_employee_terminations_staff_idx
  on public.hrm_employee_terminations (school_id, staff_id)
  where staff_id is not null;
create index hrm_employee_terminations_school_date_idx
  on public.hrm_employee_terminations (school_id, terminated_on desc);

alter table public.hrm_employee_terminations enable row level security;

create policy "HRM managers can view employee terminations"
on public.hrm_employee_terminations for select to authenticated
using (public.has_permission(school_id, 'recruitment', 'view') or public.is_super_admin());

create or replace function public.terminate_hrm_employee(
  p_school_id uuid,
  p_employee_type text,
  p_employee_id uuid,
  p_terminated_on date,
  p_reason text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_employee_status text;
  v_termination_id uuid;
  v_employee_resource text;
begin
  if auth.uid() is null or not public.has_permission(p_school_id, 'recruitment', 'manage') then
    raise exception 'You do not have permission to terminate employees.';
  end if;

  if p_employee_type is null
     or p_employee_type not in ('teacher', 'staff')
     or p_terminated_on is null
     or p_terminated_on > current_date
     or length(trim(coalesce(p_reason, ''))) not between 3 and 500
     or length(coalesce(p_notes, '')) > 2000 then
    raise exception 'Termination details are invalid.';
  end if;

  v_employee_resource := case when p_employee_type = 'teacher' then 'teachers' else 'staff' end;
  if not public.has_permission(p_school_id, v_employee_resource, 'manage') then
    raise exception 'You do not have permission to manage this employee type.';
  end if;

  if p_employee_type = 'teacher' then
    select profile_id, employment_status
      into v_profile_id, v_employee_status
      from public.teachers
     where school_id = p_school_id and id = p_employee_id
     for update;
  else
    select profile_id, employment_status
      into v_profile_id, v_employee_status
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
    school_id, employee_type, teacher_id, staff_id, terminated_on, reason, notes, terminated_by
  )
  values (
    p_school_id,
    p_employee_type,
    case when p_employee_type = 'teacher' then p_employee_id else null end,
    case when p_employee_type = 'staff' then p_employee_id else null end,
    p_terminated_on,
    trim(p_reason),
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into v_termination_id;

  if p_employee_type = 'teacher' then
    update public.teachers
       set employment_status = 'terminated',
           is_active = false,
           deleted_at = coalesce(deleted_at, p_terminated_on::timestamp at time zone 'UTC')
     where school_id = p_school_id and id = p_employee_id;
  else
    update public.staff
       set employment_status = 'terminated',
           is_active = false,
           deleted_at = coalesce(deleted_at, p_terminated_on::timestamp at time zone 'UTC')
     where school_id = p_school_id and id = p_employee_id;
  end if;

  if v_profile_id is not null then
    delete from public.user_roles
     where school_id = p_school_id
       and user_id = v_profile_id;
  end if;

  return v_termination_id;
end;
$$;

revoke all on function public.terminate_hrm_employee(uuid, text, uuid, date, text, text) from public, anon;
grant execute on function public.terminate_hrm_employee(uuid, text, uuid, date, text, text) to authenticated;
