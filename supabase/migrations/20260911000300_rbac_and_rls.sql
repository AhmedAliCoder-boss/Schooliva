alter table public.students
  add column if not exists profile_id uuid references public.profiles (id) on delete set null;

create unique index if not exists students_school_profile_key
  on public.students (school_id, profile_id)
  where profile_id is not null;

insert into public.roles (school_id, name, slug, description, is_system)
values
  (null, 'Super Admin', 'super_admin', 'Platform-wide administration', true),
  (null, 'School Admin', 'school_admin', 'Full administration within a school', true),
  (null, 'Principal', 'principal', 'Academic and operational leadership', true),
  (null, 'Teacher', 'teacher', 'Teaching and assigned academic work', true),
  (null, 'Accountant', 'accountant', 'Fees and finance operations', true),
  (null, 'HR Manager', 'hr_manager', 'People and staff operations', true),
  (null, 'Librarian', 'librarian', 'Library operations', true),
  (null, 'Transport Manager', 'transport_manager', 'Transport operations', true),
  (null, 'Staff', 'staff', 'General staff access', true),
  (null, 'Parent', 'parent', 'Parent and child access', true),
  (null, 'Student', 'student', 'Student self-service access', true)
on conflict (slug) where school_id is null do update
set name = excluded.name, description = excluded.description, is_system = true;

insert into public.permissions (resource, action, description)
values
  ('students', 'view', 'View student records'),
  ('students', 'create', 'Create student records'),
  ('students', 'update', 'Update student records'),
  ('students', 'delete', 'Archive student records'),
  ('students.attendance', 'view', 'View student attendance'),
  ('students.attendance', 'manage', 'Manage student attendance'),
  ('parents', 'view', 'View parent records'),
  ('parents', 'create', 'Create parent records'),
  ('parents', 'update', 'Update parent records'),
  ('teachers', 'view', 'View teacher records'),
  ('teachers', 'manage', 'Manage teacher records'),
  ('staff', 'view', 'View staff records'),
  ('staff', 'manage', 'Manage staff records'),
  ('classes', 'view', 'View classes and sections'),
  ('classes', 'manage', 'Manage classes and sections'),
  ('subjects', 'view', 'View subjects and curriculum'),
  ('subjects', 'manage', 'Manage subjects and curriculum'),
  ('fees', 'view', 'View fees'),
  ('fees', 'create', 'Create fees'),
  ('fees', 'update', 'Update fees'),
  ('fees', 'delete', 'Archive fees'),
  ('results', 'view', 'View results'),
  ('results', 'create', 'Create results'),
  ('results', 'update', 'Update results'),
  ('results', 'publish', 'Publish results'),
  ('users', 'manage', 'Manage school users'),
  ('roles', 'manage', 'Manage roles and permissions'),
  ('reports', 'view', 'View reports'),
  ('school_settings', 'manage', 'Manage school settings'),
  ('academic_sessions', 'manage', 'Manage academic sessions'),
  ('library', 'manage', 'Manage library operations'),
  ('transport', 'manage', 'Manage transport operations'),
  ('inventory', 'manage', 'Manage inventory operations'),
  ('leave', 'manage', 'Manage leave requests'),
  ('announcements', 'manage', 'Manage announcements')
on conflict (resource, action) do update set description = excluded.description;

do $$
declare
  role_record record;
  permission_record record;
begin
  for role_record in select id, slug from public.roles where school_id is null loop
    for permission_record in
      select id from public.permissions
      where role_record.slug in ('super_admin', 'school_admin')
         or (role_record.slug = 'principal' and resource in ('students', 'students.attendance', 'parents', 'teachers', 'staff', 'classes', 'subjects', 'results', 'reports', 'announcements', 'academic_sessions'))
         or (role_record.slug = 'teacher' and resource in ('students', 'students.attendance', 'subjects', 'classes', 'results', 'leave'))
         or (role_record.slug = 'accountant' and resource = 'fees')
         or (role_record.slug = 'hr_manager' and resource in ('teachers', 'staff', 'leave', 'reports'))
         or (role_record.slug = 'librarian' and resource = 'library')
         or (role_record.slug = 'transport_manager' and resource = 'transport')
         or (role_record.slug = 'staff' and resource in ('students', 'reports'))
         or (role_record.slug = 'parent' and resource in ('students', 'students.attendance', 'results', 'fees', 'announcements'))
         or (role_record.slug = 'student' and resource in ('students', 'students.attendance', 'results', 'announcements'))
    loop
      insert into public.role_permissions (role_id, permission_id)
      values (role_record.id, permission_record.id)
      on conflict do nothing;
    end loop;
  end loop;
end;
$$;

create or replace function public.has_school_access(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.school_id = target_school_id
  );
$$;

create or replace function public.has_permission(target_school_id uuid, target_resource text, target_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = (select auth.uid())
      and ur.school_id = target_school_id
      and (r.school_id = target_school_id or r.school_id is null)
      and p.resource = target_resource
      and p.action = target_action
  );
$$;

create or replace function public.is_parent_of_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.student_parents sp
    join public.parents p on p.id = sp.parent_id
    where sp.student_id = target_student_id
      and p.profile_id = (select auth.uid())
      and p.school_id = sp.school_id
      and p.deleted_at is null
  );
$$;

create or replace function public.is_student_record(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.id = target_student_id
      and s.profile_id = (select auth.uid())
      and s.deleted_at is null
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid()) and r.slug = 'super_admin'
  );
$$;

drop policy if exists "Users can read their own school roles" on public.user_roles;
create policy "Users can read own memberships"
on public.user_roles for select to authenticated
using (user_id = (select auth.uid()) or public.is_super_admin());

create policy "Authorized users can manage memberships"
on public.user_roles for all to authenticated
using (public.has_permission(school_id, 'users', 'manage') or public.has_permission(school_id, 'roles', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'users', 'manage') or public.has_permission(school_id, 'roles', 'manage') or public.is_super_admin());

create policy "Authorized users can read roles"
on public.roles for select to authenticated
using (school_id is null or public.has_school_access(school_id));

create policy "Authorized users can manage roles"
on public.roles for all to authenticated
using (public.has_permission(school_id, 'roles', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'roles', 'manage') or public.is_super_admin());

create policy "Authenticated users can read permissions"
on public.permissions for select to authenticated using (true);

create policy "Authorized users can manage role permissions"
on public.role_permissions for all to authenticated
using (exists (select 1 from public.roles r where r.id = role_id and (public.has_permission(r.school_id, 'roles', 'manage') or public.is_super_admin())))
with check (exists (select 1 from public.roles r where r.id = role_id and (public.has_permission(r.school_id, 'roles', 'manage') or public.is_super_admin())));

drop policy if exists "Members can read their schools" on public.schools;
create policy "Members can read their schools"
on public.schools for select to authenticated
using (public.has_school_access(id) or public.is_super_admin());

create policy "Authorized users can manage schools"
on public.schools for update to authenticated
using (public.has_permission(id, 'school_settings', 'manage') or public.is_super_admin())
with check (public.has_permission(id, 'school_settings', 'manage') or public.is_super_admin());

drop policy if exists "Members can read school settings" on public.school_settings;
create policy "Members can read school settings"
on public.school_settings for select to authenticated
using (public.has_school_access(school_id) or public.is_super_admin());

create policy "Authorized users can manage school settings"
on public.school_settings for all to authenticated
using (public.has_permission(school_id, 'school_settings', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'school_settings', 'manage') or public.is_super_admin());

create policy "Members can read academic data"
on public.academic_sessions for select to authenticated
using (public.has_school_access(school_id) or public.is_super_admin());
create policy "Authorized users can manage academic sessions"
on public.academic_sessions for all to authenticated
using (public.has_permission(school_id, 'academic_sessions', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'academic_sessions', 'manage') or public.is_super_admin());

create policy "Members can read academic terms"
on public.academic_terms for select to authenticated
using (public.has_school_access(school_id) or public.is_super_admin());
create policy "Authorized users can manage academic terms"
on public.academic_terms for all to authenticated
using (public.has_permission(school_id, 'academic_sessions', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'academic_sessions', 'manage') or public.is_super_admin());

create policy "Authorized school members can read classes"
on public.classes for select to authenticated using (public.has_school_access(school_id) or public.is_super_admin());
create policy "Authorized users can manage classes"
on public.classes for all to authenticated
using (public.has_permission(school_id, 'classes', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'classes', 'manage') or public.is_super_admin());

create policy "Authorized school members can read sections"
on public.sections for select to authenticated using (public.has_school_access(school_id) or public.is_super_admin());
create policy "Authorized users can manage sections"
on public.sections for all to authenticated
using (public.has_permission(school_id, 'classes', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'classes', 'manage') or public.is_super_admin());

create policy "Authorized school members can read subjects"
on public.subjects for select to authenticated using (public.has_school_access(school_id) or public.is_super_admin());
create policy "Authorized users can manage subjects"
on public.subjects for all to authenticated
using (public.has_permission(school_id, 'subjects', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'subjects', 'manage') or public.is_super_admin());

create policy "Authorized school members can read class subjects"
on public.class_subjects for select to authenticated using (public.has_school_access(school_id) or public.is_super_admin());
create policy "Authorized users can manage class subjects"
on public.class_subjects for all to authenticated
using (public.has_permission(school_id, 'subjects', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'subjects', 'manage') or public.is_super_admin());

create policy "People can read allowed students"
on public.students for select to authenticated
using (
  public.is_super_admin() or public.has_permission(school_id, 'students', 'view')
  or public.is_parent_of_student(id) or public.is_student_record(id)
);
create policy "Authorized users can create students"
on public.students for insert to authenticated
with check (public.has_permission(school_id, 'students', 'create') or public.is_super_admin());
create policy "Authorized users can update students"
on public.students for update to authenticated
using (public.has_permission(school_id, 'students', 'update') or public.is_super_admin() or public.is_student_record(id))
with check (public.has_permission(school_id, 'students', 'update') or public.is_super_admin() or public.is_student_record(id));
create policy "Authorized users can archive students"
on public.students for delete to authenticated
using (public.has_permission(school_id, 'students', 'delete') or public.is_super_admin());

create policy "People can read allowed parents"
on public.parents for select to authenticated
using (public.is_super_admin() or public.has_permission(school_id, 'parents', 'view') or profile_id = (select auth.uid()));
create policy "Authorized users can manage parents"
on public.parents for all to authenticated
using (public.has_permission(school_id, 'parents', 'create') or public.has_permission(school_id, 'parents', 'update') or public.is_super_admin())
with check (public.has_permission(school_id, 'parents', 'create') or public.has_permission(school_id, 'parents', 'update') or public.is_super_admin());

create policy "Parents and authorized users can read student links"
on public.student_parents for select to authenticated
using (public.is_super_admin() or public.has_permission(school_id, 'parents', 'view') or public.is_parent_of_student(student_id));
create policy "Authorized users can manage student links"
on public.student_parents for all to authenticated
using (public.has_permission(school_id, 'parents', 'update') or public.is_super_admin())
with check (public.has_permission(school_id, 'parents', 'update') or public.is_super_admin());

create policy "Authorized users can read teachers"
on public.teachers for select to authenticated using (public.has_permission(school_id, 'teachers', 'view') or public.is_super_admin() or profile_id = (select auth.uid()));
create policy "Authorized users can manage teachers"
on public.teachers for all to authenticated
using (public.has_permission(school_id, 'teachers', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'teachers', 'manage') or public.is_super_admin());

create policy "Authorized users can read staff"
on public.staff for select to authenticated using (public.has_permission(school_id, 'staff', 'view') or public.is_super_admin() or profile_id = (select auth.uid()));
create policy "Authorized users can manage staff"
on public.staff for all to authenticated
using (public.has_permission(school_id, 'staff', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'staff', 'manage') or public.is_super_admin());

create policy "People can read allowed enrollments"
on public.student_enrollments for select to authenticated
using (public.is_super_admin() or public.has_permission(school_id, 'students', 'view') or public.is_parent_of_student(student_id) or public.is_student_record(student_id));
create policy "Authorized users can manage enrollments"
on public.student_enrollments for all to authenticated
using (public.has_permission(school_id, 'students', 'create') or public.has_permission(school_id, 'students', 'update') or public.is_super_admin())
with check (public.has_permission(school_id, 'students', 'create') or public.has_permission(school_id, 'students', 'update') or public.is_super_admin());