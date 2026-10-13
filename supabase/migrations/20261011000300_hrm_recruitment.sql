create table if not exists public.hrm_job_openings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null,
  department text,
  employment_type text not null default 'full_time',
  location text,
  description text,
  requirements text,
  closing_date date,
  status text not null default 'open',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  check (length(trim(title)) > 0),
  check (employment_type in ('full_time', 'part_time', 'contract', 'temporary')),
  check (status in ('draft', 'open', 'closed'))
);

create table if not exists public.hrm_candidates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  job_id uuid,
  candidate_name text not null,
  email text,
  phone text,
  source text not null default 'other',
  stage text not null default 'applied',
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  foreign key (school_id, job_id) references public.hrm_job_openings (school_id, id) on delete set null (job_id),
  check (length(trim(candidate_name)) > 0),
  check (source in ('walk_in', 'referral', 'website', 'social_media', 'other')),
  check (stage in ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected'))
);

create table if not exists public.hrm_interviews (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  candidate_id uuid not null,
  scheduled_at timestamptz not null,
  interview_type text not null default 'in_person',
  location text,
  interviewer text,
  notes text,
  status text not null default 'scheduled',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, candidate_id) references public.hrm_candidates (school_id, id) on delete cascade,
  check (interview_type in ('in_person', 'video', 'phone')),
  check (status in ('scheduled', 'completed', 'cancelled'))
);

create index if not exists hrm_job_openings_school_status_idx
  on public.hrm_job_openings (school_id, status, created_at desc);
create index if not exists hrm_candidates_school_stage_idx
  on public.hrm_candidates (school_id, stage, created_at desc);
create index if not exists hrm_candidates_job_idx
  on public.hrm_candidates (school_id, job_id);
create index if not exists hrm_interviews_school_schedule_idx
  on public.hrm_interviews (school_id, scheduled_at, status);

create trigger set_hrm_job_openings_updated_at
before update on public.hrm_job_openings
for each row execute function public.set_updated_at();
create trigger set_hrm_candidates_updated_at
before update on public.hrm_candidates
for each row execute function public.set_updated_at();
create trigger set_hrm_interviews_updated_at
before update on public.hrm_interviews
for each row execute function public.set_updated_at();

alter table public.hrm_job_openings enable row level security;
alter table public.hrm_candidates enable row level security;
alter table public.hrm_interviews enable row level security;

insert into public.permissions (resource, action, description)
values
  ('recruitment', 'view', 'View job openings, candidates, and interviews'),
  ('recruitment', 'manage', 'Manage job openings, candidates, and interviews')
on conflict (resource, action) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.resource = 'recruitment' and p.action in ('view', 'manage')
where r.school_id is null and r.slug in ('school_admin', 'principal', 'hr_manager', 'super_admin')
on conflict do nothing;

create policy "Recruitment managers can read job openings"
on public.hrm_job_openings for select to authenticated
using (public.has_permission(school_id, 'recruitment', 'view') or public.has_permission(school_id, 'recruitment', 'manage') or public.is_super_admin());
create policy "Recruitment managers can manage job openings"
on public.hrm_job_openings for all to authenticated
using (public.has_permission(school_id, 'recruitment', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'recruitment', 'manage') or public.is_super_admin());

create policy "Recruitment managers can read candidates"
on public.hrm_candidates for select to authenticated
using (public.has_permission(school_id, 'recruitment', 'view') or public.has_permission(school_id, 'recruitment', 'manage') or public.is_super_admin());
create policy "Recruitment managers can manage candidates"
on public.hrm_candidates for all to authenticated
using (public.has_permission(school_id, 'recruitment', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'recruitment', 'manage') or public.is_super_admin());

create policy "Recruitment managers can read interviews"
on public.hrm_interviews for select to authenticated
using (public.has_permission(school_id, 'recruitment', 'view') or public.has_permission(school_id, 'recruitment', 'manage') or public.is_super_admin());
create policy "Recruitment managers can manage interviews"
on public.hrm_interviews for all to authenticated
using (public.has_permission(school_id, 'recruitment', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'recruitment', 'manage') or public.is_super_admin());
