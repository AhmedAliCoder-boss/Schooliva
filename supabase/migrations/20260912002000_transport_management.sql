create table public.transport_drivers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  full_name text not null,
  license_number text not null,
  phone text,
  status text not null default 'active' check (status in ('active', 'inactive', 'on_leave')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, license_number)
);

create table public.transport_vehicles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  registration_number text not null,
  vehicle_type text not null,
  capacity integer not null check (capacity > 0),
  status text not null default 'active' check (status in ('active', 'maintenance', 'inactive')),
  driver_id uuid references public.transport_drivers (id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, registration_number)
);

create table public.transport_routes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  vehicle_id uuid references public.transport_vehicles (id) on delete set null,
  name text not null,
  route_code text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, route_code)
);

create table public.transport_stops (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  stop_type text not null default 'pickup' check (stop_type in ('pickup', 'dropoff', 'both')),
  address text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, name)
);

create table public.transport_route_stops (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  route_id uuid not null references public.transport_routes (id) on delete cascade,
  stop_id uuid not null references public.transport_stops (id) on delete restrict,
  stop_order integer not null check (stop_order > 0),
  pickup_time time,
  dropoff_time time,
  created_at timestamptz not null default timezone('utc', now()),
  unique (route_id, stop_order),
  unique (route_id, stop_id)
);

create table public.transport_student_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete restrict,
  route_id uuid not null references public.transport_routes (id) on delete restrict,
  pickup_stop_id uuid references public.transport_stops (id) on delete set null,
  dropoff_stop_id uuid references public.transport_stops (id) on delete set null,
  assigned_on date not null default current_date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, student_id, route_id),
  unique (school_id, student_id, pickup_stop_id),
  unique (school_id, student_id, dropoff_stop_id)
);

create table public.transport_fees (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  route_id uuid not null references public.transport_routes (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  amount numeric(10,2) not null check (amount >= 0),
  frequency text not null default 'monthly' check (frequency in ('monthly', 'quarterly', 'term', 'yearly')),
  due_day integer not null check (due_day between 1 and 31),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, route_id, student_id)
);

create trigger transport_drivers_set_updated_at before update on public.transport_drivers for each row execute function public.set_updated_at();
create trigger transport_vehicles_set_updated_at before update on public.transport_vehicles for each row execute function public.set_updated_at();
create trigger transport_routes_set_updated_at before update on public.transport_routes for each row execute function public.set_updated_at();
create trigger transport_stops_set_updated_at before update on public.transport_stops for each row execute function public.set_updated_at();
create trigger transport_student_assignments_set_updated_at before update on public.transport_student_assignments for each row execute function public.set_updated_at();
create trigger transport_fees_set_updated_at before update on public.transport_fees for each row execute function public.set_updated_at();

create index transport_vehicles_school_status_idx on public.transport_vehicles (school_id, status, capacity);
create index transport_routes_school_vehicle_idx on public.transport_routes (school_id, vehicle_id, status);
create index transport_route_stops_route_order_idx on public.transport_route_stops (route_id, stop_order);
create index transport_assignments_student_route_idx on public.transport_student_assignments (school_id, student_id, route_id, status);
create index transport_fees_school_student_idx on public.transport_fees (school_id, student_id, is_active);

alter table public.transport_drivers enable row level security;
alter table public.transport_vehicles enable row level security;
alter table public.transport_routes enable row level security;
alter table public.transport_stops enable row level security;
alter table public.transport_route_stops enable row level security;
alter table public.transport_student_assignments enable row level security;
alter table public.transport_fees enable row level security;

create or replace function public.ensure_route_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity integer;
  v_count integer;
begin
  select v.capacity into v_capacity
  from public.transport_routes r
  join public.transport_vehicles v on v.id = r.vehicle_id
  where r.id = new.route_id;

  if v_capacity is null then
    raise exception 'Route must have an assigned active vehicle before student assignment';
  end if;

  select count(*) into v_count
  from public.transport_student_assignments a
  where a.route_id = new.route_id
    and a.status = 'active'
    and a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_count >= v_capacity then
    raise exception 'Vehicle capacity exceeded for this route';
  end if;

  if new.pickup_stop_id is not null and not exists (
    select 1 from public.transport_route_stops rrs where rrs.route_id = new.route_id and rrs.stop_id = new.pickup_stop_id
  ) then
    raise exception 'Pickup stop not on this route';
  end if;

  if new.dropoff_stop_id is not null and not exists (
    select 1 from public.transport_route_stops rrs where rrs.route_id = new.route_id and rrs.stop_id = new.dropoff_stop_id
  ) then
    raise exception 'Drop-off stop not on this route';
  end if;

  return new;
end;
$$;

create trigger transport_capacity_guard
before insert or update on public.transport_student_assignments
for each row
when (new.status = 'active')
execute function public.ensure_route_capacity();

create policy "School members can read vehicles"
on public.transport_vehicles for select to authenticated
using (public.has_permission(school_id, 'transport', 'manage') or public.has_permission(school_id, 'reports', 'view') or public.is_super_admin());
create policy "Authorized users can manage vehicles"
on public.transport_vehicles for all to authenticated
using (public.has_permission(school_id, 'transport', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'transport', 'manage') or public.is_super_admin());

create policy "School members can read drivers"
on public.transport_drivers for select to authenticated
using (public.has_permission(school_id, 'transport', 'manage') or public.has_permission(school_id, 'reports', 'view') or public.is_super_admin());
create policy "Authorized users can manage drivers"
on public.transport_drivers for all to authenticated
using (public.has_permission(school_id, 'transport', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'transport', 'manage') or public.is_super_admin());

create policy "School members can read routes"
on public.transport_routes for select to authenticated
using (public.has_permission(school_id, 'transport', 'manage') or public.has_permission(school_id, 'reports', 'view') or public.is_super_admin());
create policy "Authorized users can manage routes"
on public.transport_routes for all to authenticated
using (public.has_permission(school_id, 'transport', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'transport', 'manage') or public.is_super_admin());

create policy "School members can read stops"
on public.transport_stops for select to authenticated
using (public.has_permission(school_id, 'transport', 'manage') or public.has_permission(school_id, 'reports', 'view') or public.is_super_admin());
create policy "Authorized users can manage stops"
on public.transport_stops for all to authenticated
using (public.has_permission(school_id, 'transport', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'transport', 'manage') or public.is_super_admin());

create policy "School members can read route stops"
on public.transport_route_stops for select to authenticated
using (public.has_permission(school_id, 'transport', 'manage') or public.has_permission(school_id, 'reports', 'view') or public.is_super_admin());
create policy "Authorized users can manage route stops"
on public.transport_route_stops for all to authenticated
using (public.has_permission(school_id, 'transport', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'transport', 'manage') or public.is_super_admin());

create policy "School members can read student assignments"
on public.transport_student_assignments for select to authenticated
using (
  public.has_permission(school_id, 'transport', 'manage')
  or public.has_permission(school_id, 'reports', 'view')
  or public.is_super_admin()
  or student_id in (select s.id from public.students s where s.school_id = transport_student_assignments.school_id and s.profile_id = (select auth.uid()))
);
create policy "Authorized users can manage student assignments"
on public.transport_student_assignments for all to authenticated
using (public.has_permission(school_id, 'transport', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'transport', 'manage') or public.is_super_admin());

create policy "School members can read transport fees"
on public.transport_fees for select to authenticated
using (public.has_permission(school_id, 'transport', 'manage') or public.has_permission(school_id, 'reports', 'view') or public.is_super_admin());
create policy "Authorized users can manage transport fees"
on public.transport_fees for all to authenticated
using (public.has_permission(school_id, 'transport', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'transport', 'manage') or public.is_super_admin());
