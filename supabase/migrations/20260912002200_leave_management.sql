create table public.leave_types (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, name)
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  leave_type_id uuid not null references public.leave_types (id) on delete restrict,
  requester_profile_id uuid not null references public.profiles (id) on delete restrict,
  student_id uuid references public.students (id) on delete restrict,
  teacher_id uuid references public.teachers (id) on delete restrict,
  staff_id uuid references public.staff (id) on delete restrict,
  start_date date not null,
  end_date date not null,
  reason text not null,
  attachment_path text,
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'completed')),
  approver_profile_id uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  approver_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (end_date >= start_date),
  check (((student_id is not null)::int + (teacher_id is not null)::int + (staff_id is not null)::int) = 1)
);

create table public.leave_attachments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  leave_request_id uuid not null references public.leave_requests (id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create trigger leave_types_set_updated_at before update on public.leave_types for each row execute function public.set_updated_at();
create trigger leave_requests_set_updated_at before update on public.leave_requests for each row execute function public.set_updated_at();

create index leave_requests_school_status_dates_idx on public.leave_requests (school_id, status, start_date, end_date);
create index leave_requests_requester_idx on public.leave_requests (school_id, requester_profile_id, created_at desc);
create index leave_requests_student_idx on public.leave_requests (school_id, student_id, start_date desc);
create index leave_requests_teacher_idx on public.leave_requests (school_id, teacher_id, start_date desc);
create index leave_requests_staff_idx on public.leave_requests (school_id, staff_id, start_date desc);

alter table public.leave_types enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_attachments enable row level security;

insert into public.permissions (resource, action, description)
values
  ('leave', 'view', 'View authorized leave records'),
  ('leave', 'manage', 'Manage leave requests and types'),
  ('leave', 'approve', 'Approve or reject leave requests')
on conflict (resource, action) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.resource = 'leave'
where r.school_id is null and r.slug in ('super_admin', 'school_admin', 'principal', 'hr_manager', 'teacher', 'staff', 'student', 'parent')
  and (
    (r.slug in ('super_admin', 'school_admin', 'principal', 'hr_manager') and p.action in ('view', 'manage', 'approve'))
    or (r.slug in ('teacher', 'staff', 'student', 'parent') and p.action in ('view', 'manage'))
  )
on conflict do nothing;

create policy "Authorized users can read leave types"
on public.leave_types for select to authenticated
using (public.has_permission(school_id, 'leave', 'view') or public.has_permission(school_id, 'leave', 'manage') or public.is_super_admin());
create policy "Authorized users can manage leave types"
on public.leave_types for all to authenticated
using (public.has_permission(school_id, 'leave', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'leave', 'manage') or public.is_super_admin());

create policy "Users can read authorized leave requests"
on public.leave_requests for select to authenticated
using (
  public.is_super_admin()
  or public.has_permission(school_id, 'leave', 'view')
  or public.has_permission(school_id, 'leave', 'approve')
  or requester_profile_id = (select auth.uid())
  or (student_id is not null and public.is_parent_of_student(student_id))
  or (student_id is not null and public.is_student_record(student_id))
);

create policy "Users can create own leave requests"
on public.leave_requests for insert to authenticated
with check (
  requester_profile_id = (select auth.uid())
  and (
    public.has_permission(school_id, 'leave', 'manage')
    or student_id in (select s.id from public.students s where s.profile_id = (select auth.uid()) and s.school_id = leave_requests.school_id)
    or teacher_id in (select t.id from public.teachers t where t.profile_id = (select auth.uid()) and t.school_id = leave_requests.school_id)
    or staff_id in (select st.id from public.staff st where st.profile_id = (select auth.uid()) and st.school_id = leave_requests.school_id)
  )
);

create policy "Approvers can update leave workflow"
on public.leave_requests for update to authenticated
using (public.has_permission(school_id, 'leave', 'approve') or public.has_permission(school_id, 'leave', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'leave', 'approve') or public.has_permission(school_id, 'leave', 'manage') or public.is_super_admin());

create policy "Authorized users can read leave attachments"
on public.leave_attachments for select to authenticated
using (public.has_permission(school_id, 'leave', 'view') or public.has_permission(school_id, 'leave', 'approve') or public.is_super_admin() or uploaded_by = (select auth.uid()));
create policy "Authorized users can manage leave attachments"
on public.leave_attachments for all to authenticated
using (public.has_permission(school_id, 'leave', 'manage') or public.is_super_admin() or uploaded_by = (select auth.uid()))
with check (public.has_permission(school_id, 'leave', 'manage') or public.is_super_admin() or uploaded_by = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('leave-attachments', 'leave-attachments', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

create policy "Users can upload own leave attachments"
on storage.objects for insert to authenticated
with check (bucket_id = 'leave-attachments' and owner = auth.uid());

create policy "Authorized users can read leave attachments"
on storage.objects for select to authenticated
using (bucket_id = 'leave-attachments' and (owner = auth.uid() or exists (select 1 from public.leave_attachments la where la.file_path = name and (public.has_permission(la.school_id, 'leave', 'view') or public.has_permission(la.school_id, 'leave', 'approve') or public.is_super_admin()))));
