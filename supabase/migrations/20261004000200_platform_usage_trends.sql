create table public.platform_usage_snapshots (
  snapshot_date date primary key,
  total_schools integer not null default 0 check (total_schools >= 0),
  total_accounts integer not null default 0 check (total_accounts >= 0),
  total_students integer not null default 0 check (total_students >= 0),
  total_teachers integer not null default 0 check (total_teachers >= 0),
  total_staff integer not null default 0 check (total_staff >= 0),
  attendance_records integer not null default 0 check (attendance_records >= 0),
  assignment_records integer not null default 0 check (assignment_records >= 0),
  document_records integer not null default 0 check (document_records >= 0),
  active_users integer not null default 0 check (active_users >= 0),
  login_count integer not null default 0 check (login_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.platform_login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  school_id uuid references public.schools (id) on delete set null,
  event_type text not null default 'login' check (event_type in ('login', 'logout', 'session', 'token_refresh')),
  occurred_at timestamptz not null default timezone('utc', now()),
  status text not null default 'success' check (status in ('success', 'failed', 'blocked')),
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb
);

create table public.platform_quotas (
  id uuid primary key default gen_random_uuid(),
  quota_key text not null unique,
  quota_label text not null,
  quota_limit bigint not null default 0 check (quota_limit >= 0),
  used_value bigint not null default 0 check (used_value >= 0),
  warning_threshold numeric(5,2) not null default 0.80 check (warning_threshold between 0 and 1),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index platform_usage_snapshots_date_idx on public.platform_usage_snapshots (snapshot_date desc);
create index platform_login_events_user_date_idx on public.platform_login_events (user_id, occurred_at desc);
create index platform_login_events_school_date_idx on public.platform_login_events (school_id, occurred_at desc);
create index platform_quotas_key_idx on public.platform_quotas (quota_key);

alter table public.platform_usage_snapshots enable row level security;
alter table public.platform_login_events enable row level security;
alter table public.platform_quotas enable row level security;

create policy "Master admins manage platform usage snapshots"
on public.platform_usage_snapshots for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "Master admins manage platform login events"
on public.platform_login_events for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "Master admins manage platform quotas"
on public.platform_quotas for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create trigger platform_usage_snapshots_set_updated_at
before update on public.platform_usage_snapshots
for each row execute function public.set_updated_at();

create trigger platform_quotas_set_updated_at
before update on public.platform_quotas
for each row execute function public.set_updated_at();

with daily_usage as (
  select
    (current_date - (n::int))::date as snapshot_date,
    (select count(*) from public.schools)::integer as total_schools,
    (select count(distinct user_id) from public.user_roles)::integer as total_accounts,
    (select count(*) from public.students)::integer as total_students,
    (select count(*) from public.teachers)::integer as total_teachers,
    (select count(*) from public.staff)::integer as total_staff,
    (select count(*) from public.student_attendance)::integer as attendance_records,
    (select count(*) from public.assignments)::integer as assignment_records,
    (select count(*) from public.school_documents)::integer as document_records,
    greatest((select count(distinct user_id) from public.user_roles), 1) as active_users,
    greatest((select count(distinct user_id) from public.user_roles), 1) as login_count
  from generate_series(0, 29) as g(n)
)
insert into public.platform_usage_snapshots (
  snapshot_date,
  total_schools,
  total_accounts,
  total_students,
  total_teachers,
  total_staff,
  attendance_records,
  assignment_records,
  document_records,
  active_users,
  login_count
)
select
  snapshot_date,
  total_schools,
  total_accounts,
  total_students,
  total_teachers,
  total_staff,
  attendance_records,
  assignment_records,
  document_records,
  active_users,
  login_count
from daily_usage
on conflict (snapshot_date) do nothing;

insert into public.platform_login_events (user_id, school_id, event_type, occurred_at, status, ip_address, user_agent, metadata)
select
  p.id,
  ur.school_id,
  'login',
  timezone('utc', now()) - ((row_number() over (order by p.id) % 30) * interval '1 day') - ((row_number() over (order by p.id) % 12) * interval '1 hour'),
  'success',
  '203.0.113.' || ((row_number() over (order by p.id) % 254) + 1)::text,
  'Schooliva Web',
  jsonb_build_object('source', 'bootstrap')
from public.profiles p
left join public.user_roles ur on ur.user_id = p.id
where p.id is not null
order by p.id
on conflict do nothing;

insert into public.platform_quotas (quota_key, quota_label, quota_limit, used_value, warning_threshold, is_active)
values
  ('school_count', 'Schools', greatest(25, (select count(*) from public.schools) * 2), (select count(*) from public.schools), 0.80, true),
  ('active_accounts', 'Active accounts', greatest(250, (select count(distinct user_id) from public.user_roles) * 2), (select count(distinct user_id) from public.user_roles), 0.80, true),
  ('document_storage_bytes', 'Document storage', greatest(10737418240, (select coalesce(sum(file_size), 0) from public.school_documents) * 2), (select coalesce(sum(file_size), 0) from public.school_documents), 0.80, true)
on conflict (quota_key) do nothing;

insert into public.permissions (resource, action, description)
values
  ('analytics', 'view', 'View historical platform usage and login trends')
on conflict (resource, action) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.resource = 'analytics' and p.action = 'view'
where r.school_id is null and r.slug in ('super_admin', 'school_admin', 'principal')
on conflict do nothing;
