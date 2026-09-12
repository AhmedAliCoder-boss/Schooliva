create table public.curriculum_subject_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_session_id uuid not null,
  class_id uuid not null,
  subject_id uuid not null,
  credits numeric(6,2),
  grading_weight numeric(6,2),
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, academic_session_id) references public.academic_sessions (school_id, id) on delete restrict,
  foreign key (school_id, class_id) references public.classes (school_id, id) on delete restrict,
  foreign key (school_id, subject_id) references public.subjects (school_id, id) on delete restrict,
  unique (school_id, academic_session_id, class_id, subject_id),
  check (credits is null or credits >= 0),
  check (grading_weight is null or grading_weight between 0 and 100),
  check (status in ('active', 'inactive', 'archived'))
);

alter table public.teacher_assignments
  add column if not exists academic_session_id uuid;

alter table public.teacher_assignments
  add constraint teacher_assignments_session_fk
  foreign key (school_id, academic_session_id)
  references public.academic_sessions (school_id, id)
  on delete restrict;

create index curriculum_subject_assignments_session_idx
  on public.curriculum_subject_assignments (school_id, academic_session_id, class_id, status);
create index teacher_assignments_session_subject_idx
  on public.teacher_assignments (school_id, academic_session_id, subject_id, teacher_id);

create trigger curriculum_subject_assignments_set_updated_at
before update on public.curriculum_subject_assignments
for each row execute function public.set_updated_at();

alter table public.curriculum_subject_assignments enable row level security;

insert into public.permissions (resource, action, description)
values ('curriculum', 'view', 'View session curriculum'), ('curriculum', 'manage', 'Manage session curriculum')
on conflict (resource, action) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.school_id is null and r.slug in ('super_admin', 'school_admin', 'principal', 'teacher') and p.resource = 'curriculum'
on conflict do nothing;

create policy "Members can read curriculum"
on public.curriculum_subject_assignments for select to authenticated
using (public.has_permission(school_id, 'curriculum', 'view') or public.has_permission(school_id, 'curriculum', 'manage') or public.is_super_admin());

create policy "Authorized users can manage curriculum"
on public.curriculum_subject_assignments for all to authenticated
using (public.has_permission(school_id, 'curriculum', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'curriculum', 'manage') or public.is_super_admin());

drop policy if exists "Authorized users can read teacher assignments" on public.teacher_assignments;
create policy "Authorized users can read teacher assignments"
on public.teacher_assignments for select to authenticated
using (public.has_permission(school_id, 'teachers', 'view') or public.has_permission(school_id, 'curriculum', 'view') or public.is_super_admin());

drop policy if exists "Authorized users can manage teacher assignments" on public.teacher_assignments;
create policy "Authorized users can manage teacher assignments"
on public.teacher_assignments for all to authenticated
using (public.has_permission(school_id, 'teachers', 'manage') or public.has_permission(school_id, 'curriculum', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'teachers', 'manage') or public.has_permission(school_id, 'curriculum', 'manage') or public.is_super_admin());