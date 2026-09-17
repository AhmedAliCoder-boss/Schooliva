create table public.document_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  owner_profile_id uuid references public.profiles (id) on delete set null,
  student_id uuid references public.students (id) on delete cascade,
  teacher_id uuid references public.teachers (id) on delete cascade,
  document_type text not null,
  document_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  check (((student_id is not null)::int + (teacher_id is not null)::int + (owner_profile_id is not null)::int) = 1)
);

create table public.school_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  document_type text not null,
  document_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.certificate_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete restrict,
  certificate_type text not null check (certificate_type in ('character', 'bonafide', 'leaving', 'enrollment')),
  certificate_number text not null,
  issued_on date not null default current_date,
  content jsonb not null default '{}'::jsonb,
  storage_path text,
  status text not null default 'draft' check (status in ('draft', 'issued', 'revoked')),
  issued_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, certificate_number)
);

create index document_records_student_idx on public.document_records (school_id, student_id, document_type, created_at desc);
create index document_records_teacher_idx on public.document_records (school_id, teacher_id, document_type, created_at desc);
create index school_documents_type_idx on public.school_documents (school_id, document_type, created_at desc);
create index certificate_records_student_idx on public.certificate_records (school_id, student_id, certificate_type, issued_on desc);

create trigger certificate_records_set_updated_at before update on public.certificate_records for each row execute function public.set_updated_at();

alter table public.document_records enable row level security;
alter table public.school_documents enable row level security;
alter table public.certificate_records enable row level security;

insert into public.permissions (resource, action, description)
values
  ('documents', 'view', 'View authorized documents'),
  ('documents', 'manage', 'Manage documents and certificate files'),
  ('certificates', 'manage', 'Issue and manage certificates')
on conflict (resource, action) do update set description = excluded.description;

create policy "Users can read authorized document records"
on public.document_records for select to authenticated
using (
  public.is_super_admin()
  or public.has_permission(school_id, 'documents', 'view')
  or owner_profile_id = (select auth.uid())
  or (student_id is not null and (public.is_student_record(student_id) or public.is_parent_of_student(student_id)))
  or teacher_id in (select t.id from public.teachers t where t.profile_id = (select auth.uid()) and t.school_id = document_records.school_id)
);

create policy "Authorized users can manage document records"
on public.document_records for all to authenticated
using (public.has_permission(school_id, 'documents', 'manage') or public.is_super_admin() or owner_profile_id = (select auth.uid()))
with check (public.has_permission(school_id, 'documents', 'manage') or public.is_super_admin() or owner_profile_id = (select auth.uid()));

create policy "School members can read school documents"
on public.school_documents for select to authenticated
using (public.has_permission(school_id, 'documents', 'view') or public.has_permission(school_id, 'documents', 'manage') or public.is_super_admin());
create policy "Authorized users can manage school documents"
on public.school_documents for all to authenticated
using (public.has_permission(school_id, 'documents', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'documents', 'manage') or public.is_super_admin());

create policy "Users can read authorized certificates"
on public.certificate_records for select to authenticated
using (public.has_permission(school_id, 'documents', 'view') or public.has_permission(school_id, 'certificates', 'manage') or public.is_super_admin() or public.is_student_record(student_id) or public.is_parent_of_student(student_id));
create policy "Authorized users can manage certificates"
on public.certificate_records for all to authenticated
using (public.has_permission(school_id, 'certificates', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'certificates', 'manage') or public.is_super_admin());

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.resource in ('documents', 'certificates')
where r.school_id is null and r.slug in ('super_admin', 'school_admin', 'principal', 'hr_manager', 'teacher', 'parent', 'student')
  and ((r.slug in ('super_admin', 'school_admin', 'principal', 'hr_manager') and p.action in ('view', 'manage')) or (r.slug in ('teacher', 'parent', 'student') and p.action = 'view'))
on conflict do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('private-documents', 'private-documents', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('generated-certificates', 'generated-certificates', false, 10485760, ARRAY['application/pdf'])
on conflict (id) do nothing;

create policy "Authorized users can upload private documents"
on storage.objects for insert to authenticated
with check (bucket_id = 'private-documents' and owner = auth.uid());

create policy "Owners and authorized users can read private documents"
on storage.objects for select to authenticated
using (bucket_id = 'private-documents' and (owner = auth.uid() or public.is_super_admin()));

create policy "Authorized users can upload certificates"
on storage.objects for insert to authenticated
with check (bucket_id = 'generated-certificates' and owner = auth.uid());

create policy "Owners and authorized users can read certificates"
on storage.objects for select to authenticated
using (bucket_id = 'generated-certificates' and (owner = auth.uid() or public.is_super_admin()));
