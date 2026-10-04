alter table public.admissions
  add column if not exists address text;

drop policy if exists "Users with admissions access can manage admissions" on public.admissions;
create policy "Users with admissions access can manage admissions" on public.admissions
for all to authenticated
using (
  public.has_permission(school_id, 'admissions', 'view')
  or public.has_permission(school_id, 'admissions', 'create')
  or public.has_permission(school_id, 'admissions', 'update')
  or public.has_permission(school_id, 'admissions', 'delete')
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('admission-documents', 'admission-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Authorized users can upload admission documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'admission-documents'
  and exists (
    select 1
    from public.admissions a
    where a.id::text = split_part(name, '/', 2)
      and a.school_id::text = split_part(name, '/', 1)
      and (
        public.has_permission(a.school_id, 'admissions', 'manage_documents')
        or public.has_permission(a.school_id, 'admissions', 'create')
        or public.has_permission(a.school_id, 'admissions', 'update')
        or public.is_super_admin()
      )
  )
);

create policy "Authorized users can read admission documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'admission-documents'
  and exists (
    select 1
    from public.admissions a
    where a.id::text = split_part(name, '/', 2)
      and a.school_id::text = split_part(name, '/', 1)
      and (
        public.has_school_access(a.school_id)
        or public.is_super_admin()
      )
  )
);

create policy "Authorized users can delete admission documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'admission-documents'
  and exists (
    select 1
    from public.admissions a
    where a.id::text = split_part(name, '/', 2)
      and a.school_id::text = split_part(name, '/', 1)
      and (
        public.has_permission(a.school_id, 'admissions', 'manage_documents')
        or public.is_super_admin()
      )
  )
);
