create extension if not exists btree_gist;

create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_session_id uuid not null,
  class_id uuid not null,
  section_id uuid not null,
  subject_id uuid not null,
  teacher_id uuid not null,
  room text,
  day_of_week smallint not null,
  starts_at time not null,
  ends_at time not null,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, academic_session_id) references public.academic_sessions (school_id, id) on delete restrict,
  foreign key (school_id, class_id) references public.classes (school_id, id) on delete restrict,
  foreign key (school_id, class_id, section_id) references public.sections (school_id, class_id, id) on delete restrict,
  foreign key (school_id, subject_id) references public.subjects (school_id, id) on delete restrict,
  foreign key (school_id, teacher_id) references public.teachers (school_id, id) on delete restrict,
  check (day_of_week between 1 and 7),
  check (ends_at > starts_at),
  check (status in ('active', 'inactive', 'archived'))
);

alter table public.timetable_entries
  add constraint timetable_teacher_no_overlap
  exclude using gist (
    school_id with =,
    academic_session_id with =,
    teacher_id with =,
    day_of_week with =,
    tsrange(date '2000-01-01' + starts_at, date '2000-01-01' + ends_at, '[)') with &&
  ) where (status = 'active');

alter table public.timetable_entries
  add constraint timetable_section_no_overlap
  exclude using gist (
    school_id with =,
    academic_session_id with =,
    section_id with =,
    day_of_week with =,
    tsrange(date '2000-01-01' + starts_at, date '2000-01-01' + ends_at, '[)') with &&
  ) where (status = 'active');

alter table public.timetable_entries
  add constraint timetable_room_no_overlap
  exclude using gist (
    school_id with =,
    academic_session_id with =,
    room with =,
    day_of_week with =,
    tsrange(date '2000-01-01' + starts_at, date '2000-01-01' + ends_at, '[)') with &&
  ) where (status = 'active' and room is not null);

create index timetable_school_day_idx on public.timetable_entries (school_id, academic_session_id, day_of_week, starts_at);
create index timetable_section_idx on public.timetable_entries (school_id, section_id, day_of_week, starts_at);
create index timetable_teacher_idx on public.timetable_entries (school_id, teacher_id, day_of_week, starts_at);

create trigger timetable_entries_set_updated_at
before update on public.timetable_entries
for each row execute function public.set_updated_at();

alter table public.timetable_entries enable row level security;

insert into public.permissions (resource, action, description)
values ('timetable', 'view', 'View timetables'), ('timetable', 'manage', 'Manage timetable entries')
on conflict (resource, action) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.school_id is null and r.slug in ('super_admin', 'school_admin', 'principal') and p.resource = 'timetable'
on conflict do nothing;

create policy "Members can read timetable"
on public.timetable_entries for select to authenticated
using (public.has_permission(school_id, 'timetable', 'view') or public.has_permission(school_id, 'timetable', 'manage') or public.is_super_admin());

create policy "Authorized users can manage timetable"
on public.timetable_entries for all to authenticated
using (public.has_permission(school_id, 'timetable', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'timetable', 'manage') or public.is_super_admin());