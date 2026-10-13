alter table public.school_settings
  add column timetable_working_days smallint[] not null
    default array[1, 2, 3, 4, 5, 6, 7]::smallint[],
  add constraint school_settings_timetable_working_days_valid
    check (
      cardinality(timetable_working_days) between 1 and 7
      and timetable_working_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
    );

create or replace function public.enforce_timetable_working_day()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  configured_days smallint[];
begin
  if new.status <> 'active' then
    return new;
  end if;

  select timetable_working_days
  into configured_days
  from public.school_settings
  where school_id = new.school_id
  for share;

  if configured_days is null or not (new.day_of_week = any(configured_days)) then
    raise exception 'Lessons can only be scheduled on configured school working days.';
  end if;

  return new;
end;
$$;

create trigger timetable_entries_enforce_working_day
before insert or update of school_id, day_of_week, status on public.timetable_entries
for each row execute function public.enforce_timetable_working_day();

create or replace function public.save_school_timetable_working_days(
  target_school_id uuid,
  target_working_days smallint[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_school_id is null
     or not public.has_permission(target_school_id, 'timetable', 'manage') then
    raise exception 'Not authorized to manage this school timetable.';
  end if;

  if target_working_days is null
     or cardinality(target_working_days) < 1
     or cardinality(target_working_days) > 7
     or not (target_working_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[])
     or cardinality(target_working_days) <> (
       select count(distinct day_number)
       from unnest(target_working_days) as day_number
     ) then
    raise exception 'Select one or more unique days from Monday through Sunday.';
  end if;

  perform 1
  from public.school_settings
  where school_id = target_school_id
  for update;

  if not found then
    raise exception 'School settings could not be found.';
  end if;

  if exists (
    select 1
    from public.timetable_entries
    where school_id = target_school_id
      and status = 'active'
      and not (day_of_week = any(target_working_days))
  ) then
    raise exception 'Move or remove active lessons scheduled on the days you are closing before changing school working days.';
  end if;

  update public.school_settings
  set timetable_working_days = target_working_days
  where school_id = target_school_id;
end;
$$;

revoke all on function public.save_school_timetable_working_days(uuid, smallint[]) from public;
grant execute on function public.save_school_timetable_working_days(uuid, smallint[]) to authenticated;
