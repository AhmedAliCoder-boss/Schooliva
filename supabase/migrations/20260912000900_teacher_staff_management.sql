alter table public.teachers
  add column if not exists gender text,
  add column if not exists date_of_birth date,
  add column if not exists address text,
  add column if not exists qualification text,
  add column if not exists employment_status text not null default 'active';

alter table public.staff
  add column if not exists department text,
  add column if not exists employment_status text not null default 'active';

alter table public.teachers
  add constraint teachers_gender_check
  check (gender is null or gender in ('female', 'male', 'non_binary', 'undisclosed'));

alter table public.teachers
  add constraint teachers_employment_status_check
  check (employment_status in ('active', 'inactive', 'on_leave', 'terminated'));

alter table public.staff
  add constraint staff_employment_status_check
  check (employment_status in ('active', 'inactive', 'on_leave', 'terminated'));

create index if not exists teachers_school_status_idx
  on public.teachers (school_id, employment_status, last_name, first_name);
create index if not exists staff_school_status_idx
  on public.staff (school_id, employment_status, last_name, first_name);

create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  teacher_id uuid not null,
  assignment_type text not null,
  class_id uuid,
  section_id uuid,
  subject_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, teacher_id) references public.teachers (school_id, id) on delete cascade,
  foreign key (school_id, class_id) references public.classes (school_id, id) on delete cascade,
  foreign key (school_id, section_id) references public.sections (school_id, id) on delete cascade,
  foreign key (school_id, subject_id) references public.subjects (school_id, id) on delete cascade,
  check (assignment_type in ('class', 'section', 'subject')),
  check (
    (assignment_type = 'class' and class_id is not null and section_id is null and subject_id is null)
    or (assignment_type = 'section' and section_id is not null and class_id is null and subject_id is null)
    or (assignment_type = 'subject' and subject_id is not null and class_id is null and section_id is null)
  )
);

create unique index teacher_assignments_unique_key
  on public.teacher_assignments (school_id, teacher_id, assignment_type, coalesce(class_id, section_id, subject_id));
create index teacher_assignments_teacher_idx
  on public.teacher_assignments (school_id, teacher_id, assignment_type);

alter table public.teacher_assignments enable row level security;

create policy "Authorized users can read teacher assignments"
on public.teacher_assignments for select to authenticated
using (public.has_permission(school_id, 'teachers', 'view') or public.is_super_admin() or exists (select 1 from public.teachers where teachers.id = teacher_id and teachers.profile_id = (select auth.uid())));

create policy "Authorized users can manage teacher assignments"
on public.teacher_assignments for all to authenticated
using (public.has_permission(school_id, 'teachers', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'teachers', 'manage') or public.is_super_admin());