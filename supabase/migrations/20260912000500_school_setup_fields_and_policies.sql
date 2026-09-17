alter table public.schools
  add column if not exists website text;

alter table public.school_settings
  add column if not exists academic_config jsonb not null default '{}'::jsonb;

alter table public.academic_sessions
  add column if not exists status text not null default 'active';

alter table public.academic_terms
  add column if not exists status text not null default 'active';

alter table public.classes
  add column if not exists description text,
  add column if not exists status text not null default 'active';

alter table public.sections
  add column if not exists class_teacher_id uuid,
  add column if not exists status text not null default 'active';

alter table public.sections
  add constraint sections_class_teacher_fk
  foreign key (school_id, class_teacher_id)
  references public.teachers (school_id, id)
  on delete set null;

alter table public.subjects
  add column if not exists subject_type text not null default 'core',
  add column if not exists status text not null default 'active';

alter table public.subjects
  add constraint subjects_subject_type_check
  check (subject_type in ('core', 'elective', 'optional', 'co_curricular'));

alter table public.academic_sessions
  add constraint academic_sessions_status_check
  check (status in ('draft', 'active', 'completed', 'archived'));

alter table public.academic_terms
  add constraint academic_terms_status_check
  check (status in ('draft', 'active', 'completed', 'archived'));

alter table public.classes
  add constraint classes_status_check
  check (status in ('active', 'inactive', 'archived'));

alter table public.sections
  add constraint sections_status_check
  check (status in ('active', 'inactive', 'archived'));

alter table public.subjects
  add constraint subjects_status_check
  check (status in ('active', 'inactive', 'archived'));

create index if not exists academic_sessions_status_idx
  on public.academic_sessions (school_id, status, starts_on desc);
create index if not exists academic_terms_status_idx
  on public.academic_terms (school_id, academic_session_id, status, starts_on);
create index if not exists classes_status_idx
  on public.classes (school_id, status, name);
create index if not exists sections_status_idx
  on public.sections (school_id, class_id, status, name);
create index if not exists subjects_status_idx
  on public.subjects (school_id, status, name);

insert into public.permissions (resource, action, description)
values
  ('school_setup', 'view', 'View school and academic setup'),
  ('school_setup', 'manage', 'Manage school and academic setup')
on conflict (resource, action) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.school_id is null
  and r.slug in ('super_admin', 'school_admin', 'principal')
  and p.resource = 'school_setup'
on conflict do nothing;

create policy "Members can read school setup"
on public.academic_sessions for select to authenticated
using (public.has_school_access(school_id) or public.is_super_admin());

drop policy if exists "Authorized users can manage academic sessions" on public.academic_sessions;
create policy "Authorized users can manage academic sessions"
on public.academic_sessions for all to authenticated
using (public.has_permission(school_id, 'school_setup', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'school_setup', 'manage') or public.is_super_admin());

drop policy if exists "Authorized users can manage academic terms" on public.academic_terms;
create policy "Authorized users can manage academic terms"
on public.academic_terms for all to authenticated
using (public.has_permission(school_id, 'school_setup', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'school_setup', 'manage') or public.is_super_admin());

drop policy if exists "Authorized users can manage classes" on public.classes;
create policy "Authorized users can manage classes"
on public.classes for all to authenticated
using (public.has_permission(school_id, 'school_setup', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'school_setup', 'manage') or public.is_super_admin());

drop policy if exists "Authorized users can manage sections" on public.sections;
create policy "Authorized users can manage sections"
on public.sections for all to authenticated
using (public.has_permission(school_id, 'school_setup', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'school_setup', 'manage') or public.is_super_admin());

drop policy if exists "Authorized users can manage subjects" on public.subjects;
create policy "Authorized users can manage subjects"
on public.subjects for all to authenticated
using (public.has_permission(school_id, 'school_setup', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'school_setup', 'manage') or public.is_super_admin());

drop policy if exists "Authorized users can manage class subjects" on public.class_subjects;
create policy "Authorized users can manage class subjects"
on public.class_subjects for all to authenticated
using (public.has_permission(school_id, 'school_setup', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'school_setup', 'manage') or public.is_super_admin());