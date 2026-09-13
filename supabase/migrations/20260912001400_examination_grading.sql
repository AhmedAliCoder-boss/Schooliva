create table public.exam_types (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools (id) on delete cascade,
  name text not null, description text, is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id), unique (school_id, name)
);

create table public.grading_scales (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools (id) on delete cascade,
  name text not null, description text, is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id), unique (school_id, name)
);

create table public.grade_boundaries (
  id uuid primary key default gen_random_uuid(), grading_scale_id uuid not null references public.grading_scales (id) on delete cascade,
  grade text not null, min_percentage numeric(5,2) not null, max_percentage numeric(5,2) not null,
  grade_point numeric(5,2), remark text,
  unique (grading_scale_id, grade), check (min_percentage >= 0 and max_percentage <= 100 and max_percentage >= min_percentage)
);

create table public.exams (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools (id) on delete cascade,
  academic_session_id uuid not null, exam_type_id uuid not null, name text not null,
  starts_on date not null, ends_on date not null, status text not null default 'draft',
  grading_scale_id uuid, created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, academic_session_id) references public.academic_sessions (school_id, id) on delete restrict,
  foreign key (school_id, exam_type_id) references public.exam_types (school_id, id) on delete restrict,
  foreign key (school_id, grading_scale_id) references public.grading_scales (school_id, id) on delete restrict,
  unique (school_id, id),
  unique (school_id, academic_session_id, name), check (ends_on >= starts_on),
  check (status in ('draft', 'submitted', 'reviewed', 'published'))
);

create table public.exam_subjects (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools (id) on delete cascade,
  exam_id uuid not null, subject_id uuid not null,
  class_id uuid not null, maximum_marks numeric(8,2) not null, passing_marks numeric(8,2),
  created_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  foreign key (school_id, exam_id) references public.exams (school_id, id) on delete cascade,
  foreign key (school_id, subject_id) references public.subjects (school_id, id) on delete restrict,
  foreign key (school_id, class_id) references public.classes (school_id, id) on delete restrict,
  unique (exam_id, class_id, subject_id), check (maximum_marks > 0), check (passing_marks is null or passing_marks between 0 and maximum_marks)
);

create table public.exam_schedules (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools (id) on delete cascade,
  exam_subject_id uuid not null, section_id uuid not null,
  scheduled_on date not null, starts_at time not null, ends_at time not null, room text,
  unique (school_id, id),
  foreign key (school_id, exam_subject_id) references public.exam_subjects (school_id, id) on delete cascade,
  foreign key (school_id, section_id) references public.sections (school_id, id) on delete restrict,
  unique (exam_subject_id, section_id, scheduled_on), check (ends_at > starts_at)
);

create table public.marks (
  id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools (id) on delete cascade,
  exam_subject_id uuid not null, student_id uuid not null,
  obtained_marks numeric(8,2) not null, percentage numeric(6,2) not null default 0,
  grade text, remarks text, entered_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  foreign key (school_id, exam_subject_id) references public.exam_subjects (school_id, id) on delete cascade,
  foreign key (school_id, student_id) references public.students (school_id, id) on delete cascade,
  unique (exam_subject_id, student_id), check (obtained_marks >= 0)
);

create or replace function public.validate_mark_range()
returns trigger language plpgsql security definer set search_path = public as $$
declare maximum numeric;
begin select maximum_marks into maximum from public.exam_subjects where id = new.exam_subject_id;
  if new.obtained_marks > maximum then raise exception 'Obtained marks cannot exceed maximum marks'; end if;
  new.percentage := round((new.obtained_marks / nullif(maximum, 0)) * 100, 2);
  if exists (select 1 from public.exams e join public.exam_subjects es on es.exam_id = e.id where es.id = new.exam_subject_id and e.status = 'published') then raise exception 'Published exam marks cannot be modified'; end if;
  return new;
end; $$;
create trigger marks_validate_range before insert or update on public.marks for each row execute function public.validate_mark_range();

create or replace function public.enforce_exam_workflow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'published' and new.status <> 'published' then raise exception 'Published exams cannot move backwards'; end if;
  if new.status = 'submitted' and old.status <> 'draft' then raise exception 'Only draft exams can be submitted'; end if;
  if new.status = 'reviewed' and old.status <> 'submitted' then raise exception 'Only submitted exams can be reviewed'; end if;
  if new.status = 'published' and old.status <> 'reviewed' then raise exception 'Only reviewed exams can be published'; end if;
  return new;
end; $$;
create trigger exams_enforce_workflow before update of status on public.exams for each row execute function public.enforce_exam_workflow();

create index exams_session_status_idx on public.exams (school_id, academic_session_id, status, starts_on);
create index exam_subjects_exam_idx on public.exam_subjects (school_id, exam_id, class_id);
create index marks_student_idx on public.marks (school_id, student_id, exam_subject_id);

create trigger exam_types_set_updated_at before update on public.exam_types for each row execute function public.set_updated_at();
create trigger grading_scales_set_updated_at before update on public.grading_scales for each row execute function public.set_updated_at();
create trigger exams_set_updated_at before update on public.exams for each row execute function public.set_updated_at();
create trigger marks_set_updated_at before update on public.marks for each row execute function public.set_updated_at();

alter table public.exam_types enable row level security; alter table public.grading_scales enable row level security; alter table public.grade_boundaries enable row level security; alter table public.exams enable row level security; alter table public.exam_subjects enable row level security; alter table public.exam_schedules enable row level security; alter table public.marks enable row level security;

insert into public.permissions (resource, action, description) values
('exams', 'view', 'View exams and schedules'), ('exams', 'manage', 'Manage exams and schedules'),
('grading', 'manage', 'Manage grading scales and marks'), ('results', 'publish', 'Publish reviewed results')
on conflict (resource, action) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.school_id is null
  and (
    (r.slug in ('super_admin', 'school_admin', 'principal') and p.resource in ('exams', 'grading'))
    or (r.slug = 'teacher' and ((p.resource = 'exams' and p.action = 'view') or (p.resource = 'grading' and p.action = 'manage')))
  )
on conflict do nothing;

create policy "Members can read exam types"
on public.exam_types for select to authenticated
using (public.has_school_access(school_id) or public.is_super_admin());
create policy "Authorized users can manage exam types"
on public.exam_types for all to authenticated
using (public.has_permission(school_id, 'exams', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'exams', 'manage') or public.is_super_admin());

create policy "Members can read exams" on public.exams for select to authenticated using (public.has_permission(school_id, 'exams', 'view') or public.has_permission(school_id, 'exams', 'manage') or public.is_super_admin());
create policy "Authorized users can manage exams" on public.exams for all to authenticated using (public.has_permission(school_id, 'exams', 'manage') or public.is_super_admin()) with check (public.has_permission(school_id, 'exams', 'manage') or public.is_super_admin());
create policy "Members can read exam subjects" on public.exam_subjects for select to authenticated using (public.has_permission(school_id, 'exams', 'view') or public.has_permission(school_id, 'grading', 'manage') or public.is_super_admin());
create policy "Authorized users can manage exam subjects" on public.exam_subjects for all to authenticated using (public.has_permission(school_id, 'exams', 'manage') or public.has_permission(school_id, 'grading', 'manage') or public.is_super_admin()) with check (public.has_permission(school_id, 'exams', 'manage') or public.has_permission(school_id, 'grading', 'manage') or public.is_super_admin());
create policy "Members can read grading" on public.grading_scales for select to authenticated using (public.has_school_access(school_id) or public.is_super_admin());
create policy "Authorized users can manage grading" on public.grading_scales for all to authenticated using (public.has_permission(school_id, 'grading', 'manage') or public.is_super_admin()) with check (public.has_permission(school_id, 'grading', 'manage') or public.is_super_admin());
create policy "Authorized users can read grade boundaries" on public.grade_boundaries for select to authenticated using (exists (select 1 from public.grading_scales gs where gs.id = grading_scale_id and (public.has_school_access(gs.school_id) or public.is_super_admin())));
create policy "Authorized users can manage grade boundaries" on public.grade_boundaries for all to authenticated using (exists (select 1 from public.grading_scales gs where gs.id = grading_scale_id and (public.has_permission(gs.school_id, 'grading', 'manage') or public.is_super_admin()))) with check (exists (select 1 from public.grading_scales gs where gs.id = grading_scale_id and (public.has_permission(gs.school_id, 'grading', 'manage') or public.is_super_admin())));
create policy "Members can read exam schedules" on public.exam_schedules for select to authenticated using (public.has_school_access(school_id) or public.is_super_admin());
create policy "Authorized users can manage exam schedules" on public.exam_schedules for all to authenticated using (public.has_permission(school_id, 'exams', 'manage') or public.is_super_admin()) with check (public.has_permission(school_id, 'exams', 'manage') or public.is_super_admin());
create policy "Allowed users can read marks" on public.marks for select to authenticated using (public.has_permission(school_id, 'grading', 'manage') or public.has_permission(school_id, 'exams', 'view') or public.is_parent_of_student(student_id) or public.is_student_record(student_id) or public.is_super_admin());
create policy "Authorized users can manage marks" on public.marks for all to authenticated using (public.has_permission(school_id, 'grading', 'manage') or public.is_super_admin()) with check (public.has_permission(school_id, 'grading', 'manage') or public.is_super_admin());