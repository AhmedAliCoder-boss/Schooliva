alter table public.students
  add column if not exists student_identifier text,
  add column if not exists blood_group text,
  add column if not exists nationality text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists medical_notes text,
  add column if not exists previous_school text,
  add column if not exists documents_metadata jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'active';

alter table public.students
  add constraint students_status_check
  check (status in ('active', 'inactive', 'archived'));

alter table public.students
  add constraint students_blood_group_check
  check (blood_group is null or blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'));

create unique index if not exists students_school_identifier_key
  on public.students (school_id, student_identifier)
  where student_identifier is not null;
create index if not exists students_school_status_idx
  on public.students (school_id, status, last_name, first_name);
create index if not exists students_admission_number_search_idx
  on public.students (school_id, admission_number);

create table if not exists public.student_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null,
  document_type text not null,
  document_name text not null,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, student_id) references public.students (school_id, id) on delete cascade,
  check (length(trim(document_type)) > 0),
  check (length(trim(document_name)) > 0)
);

create index if not exists student_documents_student_idx
  on public.student_documents (school_id, student_id, created_at desc);

alter table public.student_documents enable row level security;

create policy "Allowed users can read student documents"
on public.student_documents for select to authenticated
using (
  public.is_super_admin()
  or public.has_permission(school_id, 'students', 'view')
  or public.is_parent_of_student(student_id)
  or public.is_student_record(student_id)
);

create policy "Authorized users can manage student documents"
on public.student_documents for all to authenticated
using (public.has_permission(school_id, 'students', 'update') or public.is_super_admin())
with check (public.has_permission(school_id, 'students', 'update') or public.is_super_admin());