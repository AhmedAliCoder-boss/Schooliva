alter table public.inventory_transactions
  add column if not exists purchase_department text,
  add column if not exists purchase_order_number text,
  add column if not exists bill_storage_path text,
  add column if not exists bill_file_name text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inventory-purchase-bills',
  'inventory-purchase-bills',
  false,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Inventory managers can upload purchase bills" on storage.objects;
create policy "Inventory managers can upload purchase bills"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'inventory-purchase-bills'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1
    from public.schools s
    where s.id::text = (storage.foldername(name))[1]
      and (public.has_permission(s.id, 'inventory', 'manage') or public.is_super_admin())
  )
);

drop policy if exists "Authorized users can read inventory purchase bills" on storage.objects;
create policy "Authorized users can read inventory purchase bills"
on storage.objects for select to authenticated
using (
  bucket_id = 'inventory-purchase-bills'
  and exists (
    select 1
    from public.schools s
    where s.id::text = (storage.foldername(name))[1]
      and (
        public.has_permission(s.id, 'inventory', 'manage')
        or public.has_permission(s.id, 'inventory', 'view')
        or public.has_permission(s.id, 'reports', 'view')
        or public.is_super_admin()
      )
  )
);

drop policy if exists "Inventory managers can remove purchase bills" on storage.objects;
create policy "Inventory managers can remove purchase bills"
on storage.objects for delete to authenticated
using (
  bucket_id = 'inventory-purchase-bills'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1
    from public.schools s
    where s.id::text = (storage.foldername(name))[1]
      and (public.has_permission(s.id, 'inventory', 'manage') or public.is_super_admin())
  )
);
