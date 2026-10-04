create type public.admission_status as enum (
  'draft',
  'submitted',
  'under_review',
  'documents_pending',
  'test_pending',
  'interview_pending',
  'approved',
  'rejected',
  'waitlisted',
  'admitted',
  'converted_to_student'
);

create type public.admission_stage_status as enum (
  'not_started',
  'pending',
  'verified',
  'rejected'
);

create table if not exists public.admissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  application_number text not null,
  applicant_name text not null,
  student_photo_url text,
  date_of_birth date,
  gender text not null default 'prefer_not_to_say',
  email text,
  phone text,
  guardian_name text,
  guardian_phone text,
  applied_class_id uuid references public.classes (id) on delete set null,
  academic_session_id uuid references public.academic_sessions (id) on delete set null,
  application_source text not null default 'website',
  status public.admission_status not null default 'draft',
  documents_status public.admission_stage_status not null default 'not_started',
  test_status public.admission_stage_status not null default 'not_started',
  interview_status public.admission_stage_status not null default 'not_started',
  application_date date not null default current_date,
  notes text,
  student_id uuid references public.students (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, application_number)
);

create table if not exists public.admission_documents (
  id uuid primary key default gen_random_uuid(),
  admission_id uuid not null references public.admissions (id) on delete cascade,
  document_type text not null,
  file_name text not null,
  storage_path text not null,
  status public.admission_stage_status not null default 'pending',
  uploaded_at timestamptz not null default now()
);

create index if not exists admissions_school_status_idx on public.admissions (school_id, status);
create index if not exists admissions_application_date_idx on public.admissions (school_id, application_date);
create index if not exists admissions_class_session_idx on public.admissions (school_id, applied_class_id, academic_session_id);
create index if not exists admission_documents_admission_idx on public.admission_documents (admission_id, document_type);

insert into public.permissions (resource, action, description)
values
  ('admissions', 'view', 'View admission applications'),
  ('admissions', 'create', 'Create admission applications'),
  ('admissions', 'update', 'Update admission applications'),
  ('admissions', 'delete', 'Delete admission applications'),
  ('admissions', 'review', 'Review admissions and stage decisions'),
  ('admissions', 'approve', 'Approve admissions'),
  ('admissions', 'reject', 'Reject admissions'),
  ('admissions', 'manage_documents', 'Manage admission documents'),
  ('admissions', 'manage_tests', 'Manage admission tests and assessments'),
  ('admissions', 'manage_interviews', 'Manage admission interviews'),
  ('admissions', 'manage_settings', 'Manage admissions settings')
on conflict (resource, action) do update set description = excluded.description;

do $$
declare
  role_record record;
  permission_record record;
begin
  for role_record in select id, slug from public.roles where school_id is null loop
    for permission_record in
      select id from public.permissions where resource = 'admissions'
    loop
      if role_record.slug in ('super_admin', 'school_admin') then
        insert into public.role_permissions (role_id, permission_id)
        values (role_record.id, permission_record.id)
        on conflict do nothing;
      elsif role_record.slug = 'principal' then
        insert into public.role_permissions (role_id, permission_id)
        values (role_record.id, permission_record.id)
        on conflict do nothing;
      end if;
    end loop;
  end loop;
end;
$$;

create policy "School users can read admissions" on public.admissions
for select to authenticated
using (public.has_school_access(school_id));

create policy "Users with admissions access can manage admissions" on public.admissions
for all to authenticated
using (
  public.has_permission(school_id, 'admissions', 'view')
  or public.has_permission(school_id, 'admissions', 'create')
  or public.has_permission(school_id, 'admissions', 'update')
  or public.has_permission(school_id, 'admissions', 'review')
  or public.has_permission(school_id, 'admissions', 'approve')
  or public.has_permission(school_id, 'admissions', 'reject')
  or public.has_permission(school_id, 'admissions', 'manage_documents')
  or public.has_permission(school_id, 'admissions', 'manage_tests')
  or public.has_permission(school_id, 'admissions', 'manage_interviews')
  or public.has_permission(school_id, 'admissions', 'manage_settings')
  or public.is_super_admin()
)
with check (
  public.has_permission(school_id, 'admissions', 'create')
  or public.has_permission(school_id, 'admissions', 'update')
  or public.has_permission(school_id, 'admissions', 'review')
  or public.has_permission(school_id, 'admissions', 'approve')
  or public.has_permission(school_id, 'admissions', 'reject')
  or public.has_permission(school_id, 'admissions', 'manage_documents')
  or public.has_permission(school_id, 'admissions', 'manage_tests')
  or public.has_permission(school_id, 'admissions', 'manage_interviews')
  or public.has_permission(school_id, 'admissions', 'manage_settings')
  or public.is_super_admin()
);

create policy "School users can manage admission documents" on public.admission_documents
for all to authenticated
using (
  exists (
    select 1 from public.admissions a
    where a.id = admission_id and public.has_school_access(a.school_id)
  )
)
with check (
  exists (
    select 1 from public.admissions a
    where a.id = admission_id and (
      public.has_permission(a.school_id, 'admissions', 'manage_documents')
      or public.has_permission(a.school_id, 'admissions', 'create')
      or public.has_permission(a.school_id, 'admissions', 'update')
      or public.is_super_admin()
    )
  )
);

alter table public.admissions enable row level security;
alter table public.admission_documents enable row level security;
