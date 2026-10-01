create table public.platform_contracts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  contract_number text not null,
  plan_name text not null,
  pricing_model text not null default 'monthly' check (pricing_model in ('monthly', 'annual', 'custom')),
  monthly_amount numeric(12,2) not null default 0 check (monthly_amount >= 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'expired', 'cancelled')),
  start_date date not null default current_date,
  end_date date,
  renewal_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, contract_number)
);

create table public.school_trials (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  trial_name text not null default 'Standard trial',
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'converted')),
  starts_on date not null default current_date,
  ends_on date not null,
  seats integer not null default 25 check (seats > 0),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, trial_name)
);

create index platform_contracts_school_status_idx on public.platform_contracts (school_id, status, start_date desc);
create index platform_trials_school_status_idx on public.school_trials (school_id, status, starts_on desc);

alter table public.platform_contracts enable row level security;
alter table public.school_trials enable row level security;

create trigger platform_contracts_set_updated_at before update on public.platform_contracts for each row execute function public.set_updated_at();
create trigger school_trials_set_updated_at before update on public.school_trials for each row execute function public.set_updated_at();

insert into public.permissions (resource, action, description)
values
  ('contracts', 'view', 'View platform contracts and lease records'),
  ('contracts', 'manage', 'Manage platform contracts and terms'),
  ('trials', 'view', 'View school trial assignments'),
  ('trials', 'manage', 'Manage school trial status and seats'),
  ('billing', 'view', 'View billing and payment totals'),
  ('billing', 'manage', 'Manage billing records and payment operations')
on conflict (resource, action) do update set description = excluded.description;

create policy "Master admins and school members can read platform contracts"
on public.platform_contracts for select to authenticated
using (public.has_school_access(school_id) or public.is_super_admin());

create policy "Authorized users can manage platform contracts"
on public.platform_contracts for all to authenticated
using (public.has_permission(school_id, 'school_settings', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'school_settings', 'manage') or public.is_super_admin());

create policy "Master admins and school members can read school trials"
on public.school_trials for select to authenticated
using (public.has_school_access(school_id) or public.is_super_admin());

create policy "Authorized users can manage school trials"
on public.school_trials for all to authenticated
using (public.has_permission(school_id, 'school_settings', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'school_settings', 'manage') or public.is_super_admin());

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.resource in ('contracts', 'trials', 'billing')
where r.school_id is null
  and r.slug in ('super_admin', 'school_admin', 'principal')
  and p.action in ('view', 'manage')
on conflict do nothing;
