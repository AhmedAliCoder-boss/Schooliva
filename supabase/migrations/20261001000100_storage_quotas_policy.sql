create table public.school_storage_quotas (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references public.schools (id) on delete cascade,
  quota_bytes bigint not null default 1073741824 check (quota_bytes >= 0),
  warning_threshold numeric(5,2) not null default 0.80 check (warning_threshold between 0 and 1),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger school_storage_quotas_set_updated_at
before update on public.school_storage_quotas
for each row execute function public.set_updated_at();

create index school_storage_quotas_school_idx on public.school_storage_quotas (school_id, is_active);

alter table public.school_storage_quotas enable row level security;

insert into public.school_storage_quotas (school_id, quota_bytes, warning_threshold, is_active)
select id, 1073741824, 0.80, true
from public.schools
on conflict (school_id) do nothing;

insert into public.permissions (resource, action, description)
values
  ('storage', 'view', 'View storage footprint and quotas'),
  ('storage', 'manage', 'Manage storage limits and quota policy')
on conflict (resource, action) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.resource = 'storage'
where r.school_id is null and r.slug in ('super_admin', 'school_admin', 'principal')
  and p.action in ('view', 'manage')
on conflict do nothing;

create policy "School administrators can read storage quotas"
on public.school_storage_quotas for select to authenticated
using (public.is_super_admin() or public.has_permission(school_id, 'documents', 'view') or public.has_permission(school_id, 'documents', 'manage'));

create policy "Master admins can manage storage quotas"
on public.school_storage_quotas for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());
