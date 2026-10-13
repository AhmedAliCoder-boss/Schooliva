create table public.timetable_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  period_number smallint not null,
  name text not null,
  starts_at time not null,
  ends_at time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  unique (school_id, period_number),
  check (period_number between 1 and 16),
  check (length(trim(name)) between 1 and 60),
  check (ends_at > starts_at)
);

alter table public.timetable_entries
  add column period_number smallint,
  add constraint timetable_entries_period_number_check
    check (period_number is null or period_number between 1 and 16),
  add constraint timetable_entries_period_fk
    foreign key (school_id, period_number)
    references public.timetable_periods (school_id, period_number)
    on delete restrict;

create index timetable_periods_school_active_idx
  on public.timetable_periods (school_id, is_active, period_number);

create trigger timetable_periods_set_updated_at
before update on public.timetable_periods
for each row execute function public.set_updated_at();

create or replace function public.sync_timetable_period_times()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at then
    update public.timetable_entries
    set starts_at = new.starts_at,
        ends_at = new.ends_at
    where school_id = new.school_id
      and period_number = new.period_number;
  end if;
  return new;
end;
$$;

create trigger timetable_periods_sync_entry_times
after update of starts_at, ends_at on public.timetable_periods
for each row execute function public.sync_timetable_period_times();

alter table public.timetable_entries drop constraint if exists timetable_teacher_no_overlap;
alter table public.timetable_entries drop constraint if exists timetable_section_no_overlap;
alter table public.timetable_entries drop constraint if exists timetable_room_no_overlap;

alter table public.timetable_entries
  add constraint timetable_teacher_no_overlap
  exclude using gist (
    school_id with =,
    academic_session_id with =,
    teacher_id with =,
    day_of_week with =,
    tsrange(date '2000-01-01' + starts_at, date '2000-01-01' + ends_at, '[)') with &&
  ) where (status = 'active')
  deferrable initially immediate;

alter table public.timetable_entries
  add constraint timetable_section_no_overlap
  exclude using gist (
    school_id with =,
    academic_session_id with =,
    section_id with =,
    day_of_week with =,
    tsrange(date '2000-01-01' + starts_at, date '2000-01-01' + ends_at, '[)') with &&
  ) where (status = 'active')
  deferrable initially immediate;

alter table public.timetable_entries
  add constraint timetable_room_no_overlap
  exclude using gist (
    school_id with =,
    academic_session_id with =,
    room with =,
    day_of_week with =,
    tsrange(date '2000-01-01' + starts_at, date '2000-01-01' + ends_at, '[)') with &&
  ) where (status = 'active' and room is not null)
  deferrable initially immediate;

drop policy if exists "Members can read timetable periods" on public.timetable_periods;
create policy "Members can read timetable periods"
on public.timetable_periods for select to authenticated
using (
  public.has_permission(school_id, 'timetable', 'view')
  or public.has_permission(school_id, 'timetable', 'manage')
  or public.is_super_admin()
);

drop policy if exists "Authorized users can manage timetable periods" on public.timetable_periods;
create policy "Authorized users can manage timetable periods"
on public.timetable_periods for all to authenticated
using (public.has_permission(school_id, 'timetable', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'timetable', 'manage') or public.is_super_admin());

alter table public.timetable_periods enable row level security;

create or replace function public.save_school_timetable_periods(
  target_school_id uuid,
  target_periods jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  period_count integer;
  period_row record;
  other_row record;
  current_start time;
  current_end time;
  other_start time;
  other_end time;
  current_name text;
begin
  if target_school_id is null
     or not public.has_permission(target_school_id, 'timetable', 'manage') then
    raise exception 'Not authorized to manage this school timetable.';
  end if;
  if jsonb_typeof(target_periods) <> 'array' then
    raise exception 'Period configuration must be a list.';
  end if;

  period_count := jsonb_array_length(target_periods);
  if period_count < 1 or period_count > 16 then
    raise exception 'Configure between 1 and 16 daily periods.';
  end if;

  for period_row in
    select value, ordinality
    from jsonb_array_elements(target_periods) with ordinality
  loop
    if jsonb_typeof(period_row.value) <> 'object'
       or coalesce(period_row.value ->> 'periodNumber', '') !~ '^[0-9]+$' then
      raise exception 'Each period needs a valid number, name, start, and end time.';
    end if;
    if (period_row.value ->> 'periodNumber')::integer <> period_row.ordinality then
      raise exception 'Period numbers must be consecutive, starting at 1.';
    end if;

    current_name := nullif(trim(period_row.value ->> 'name'), '');
    if current_name is null or length(current_name) > 60 then
      raise exception 'Each period needs a name of 1 to 60 characters.';
    end if;
    if coalesce(period_row.value ->> 'startsAt', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or coalesce(period_row.value ->> 'endsAt', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'Use a valid 24-hour start and end time for each period.';
    end if;

    current_start := (period_row.value ->> 'startsAt')::time;
    current_end := (period_row.value ->> 'endsAt')::time;
    if current_end <= current_start then
      raise exception 'Each period must end after it starts.';
    end if;

    for other_row in
      select value
      from jsonb_array_elements(target_periods) with ordinality
      where ordinality <> period_row.ordinality
    loop
      other_start := (other_row.value ->> 'startsAt')::time;
      other_end := (other_row.value ->> 'endsAt')::time;
      if current_start < other_end and current_end > other_start then
        raise exception 'Period times cannot overlap.';
      end if;
    end loop;
  end loop;

  if exists (
    select 1
    from public.timetable_entries
    where school_id = target_school_id
      and period_number > period_count
  ) then
    raise exception 'Remove or move lessons from periods above the configured daily period count first.';
  end if;

  set constraints timetable_teacher_no_overlap,
    timetable_section_no_overlap,
    timetable_room_no_overlap deferred;

  for period_row in
    select value, ordinality
    from jsonb_array_elements(target_periods) with ordinality
  loop
    insert into public.timetable_periods (
      school_id, period_number, name, starts_at, ends_at, is_active
    )
    values (
      target_school_id,
      period_row.ordinality,
      trim(period_row.value ->> 'name'),
      (period_row.value ->> 'startsAt')::time,
      (period_row.value ->> 'endsAt')::time,
      true
    )
    on conflict (school_id, period_number) do update
      set name = excluded.name,
          starts_at = excluded.starts_at,
          ends_at = excluded.ends_at,
          is_active = true;
  end loop;

  update public.timetable_periods
  set is_active = false
  where school_id = target_school_id
    and period_number > period_count
    and is_active;

  set constraints timetable_teacher_no_overlap,
    timetable_section_no_overlap,
    timetable_room_no_overlap immediate;
end;
$$;

revoke all on function public.save_school_timetable_periods(uuid, jsonb) from public;
grant execute on function public.save_school_timetable_periods(uuid, jsonb) to authenticated;
