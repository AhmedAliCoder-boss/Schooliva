create table public.school_branding (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  logo_path text,
  logo_dark_path text,
  favicon_path text,
  primary_color text not null default '#2563eb' check (primary_color ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$' or primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color text not null default '#0f172a' check (secondary_color ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$' or secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  accent_color text not null default '#f59e0b' check (accent_color ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$' or accent_color ~ '^#[0-9a-fA-F]{6}$'),
  background_color text not null default '#f8fafc' check (background_color ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$' or background_color ~ '^#[0-9a-fA-F]{6}$'),
  foreground_color text not null default '#0f172a' check (foreground_color ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$' or foreground_color ~ '^#[0-9a-fA-F]{6}$'),
  card_color text not null default '#ffffff' check (card_color ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$' or card_color ~ '^#[0-9a-fA-F]{6}$'),
  muted_color text not null default '#64748b' check (muted_color ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$' or muted_color ~ '^#[0-9a-fA-F]{6}$'),
  border_color text not null default '#dfe7ee' check (border_color ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$' or border_color ~ '^#[0-9a-fA-F]{6}$'),
  success_color text not null default '#16a34a' check (success_color ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$' or success_color ~ '^#[0-9a-fA-F]{6}$'),
  warning_color text not null default '#f59e0b' check (warning_color ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$' or warning_color ~ '^#[0-9a-fA-F]{6}$'),
  destructive_color text not null default '#dc2626' check (destructive_color ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$' or destructive_color ~ '^#[0-9a-fA-F]{6}$'),
  info_color text not null default '#2563eb' check (info_color ~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$' or info_color ~ '^#[0-9a-fA-F]{6}$'),
  theme_mode text not null default 'light' check (theme_mode in ('light', 'dark', 'system')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id)
);

create index school_branding_school_idx on public.school_branding (school_id);

alter table public.school_branding enable row level security;

create trigger school_branding_set_updated_at before update on public.school_branding for each row execute function public.set_updated_at();

insert into public.permissions (resource, action, description)
values
  ('branding', 'view', 'View a school branding profile'),
  ('branding', 'manage', 'Manage school branding and appearance')
on conflict (resource, action) do update set description = excluded.description;

create policy "Members can read authorized school branding"
on public.school_branding for select to authenticated
using (public.has_school_access(school_id) or public.is_super_admin());

create policy "Authorized users can manage school branding"
on public.school_branding for all to authenticated
using (public.has_permission(school_id, 'school_settings', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'school_settings', 'manage') or public.is_super_admin());

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.resource = 'branding'
where r.school_id is null and r.slug in ('super_admin', 'school_admin', 'principal')
  and p.action in ('view', 'manage')
on conflict do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-branding', 'school-branding', false, 5242880, ARRAY['image/png','image/jpeg','image/svg+xml','image/webp'])
on conflict (id) do nothing;

create policy "Authenticated users can upload school branding assets"
on storage.objects for insert to authenticated
with check (bucket_id = 'school-branding' and (owner = auth.uid() or public.has_permission((select school_id from public.school_branding where school_id = split_part(name, '/', 1)::uuid), 'school_settings', 'manage') or public.is_super_admin()));

create policy "Authorized users can read school branding assets"
on storage.objects for select to authenticated
using (bucket_id = 'school-branding' and (owner = auth.uid() or public.has_school_access((select school_id from public.school_branding where school_id = split_part(name, '/', 1)::uuid)) or public.is_super_admin()));

create policy "Authorized users can update school branding assets"
on storage.objects for update to authenticated
using (bucket_id = 'school-branding' and (owner = auth.uid() or public.has_permission((select school_id from public.school_branding where school_id = split_part(name, '/', 1)::uuid), 'school_settings', 'manage') or public.is_super_admin()))
with check (bucket_id = 'school-branding' and (owner = auth.uid() or public.has_permission((select school_id from public.school_branding where school_id = split_part(name, '/', 1)::uuid), 'school_settings', 'manage') or public.is_super_admin()));

create policy "Authorized users can delete school branding assets"
on storage.objects for delete to authenticated
using (bucket_id = 'school-branding' and (owner = auth.uid() or public.has_permission((select school_id from public.school_branding where school_id = split_part(name, '/', 1)::uuid), 'school_settings', 'manage') or public.is_super_admin()));
