create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null,
  title text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  check (length(trim(event_type)) > 0)
);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null,
  in_app_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, profile_id, event_type)
);

create index notifications_recipient_read_idx on public.notifications (school_id, recipient_profile_id, read_at, created_at desc);
create index notifications_entity_idx on public.notifications (school_id, entity_type, entity_id);
create index notification_preferences_profile_idx on public.notification_preferences (school_id, profile_id, event_type);

create trigger notification_preferences_set_updated_at before update on public.notification_preferences for each row execute function public.set_updated_at();

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

insert into public.permissions (resource, action, description)
values ('notifications', 'view', 'View personal in-app notifications'), ('notifications', 'manage', 'Create and manage school notifications')
on conflict (resource, action) do update set description = excluded.description;

create policy "Users can read own notifications"
on public.notifications for select to authenticated
using (recipient_profile_id = (select auth.uid()));

create policy "Users can update own notification read state"
on public.notifications for update to authenticated
using (recipient_profile_id = (select auth.uid()))
with check (recipient_profile_id = (select auth.uid()));

create policy "Authorized users can create notifications"
on public.notifications for insert to authenticated
with check (public.has_permission(school_id, 'notifications', 'manage') or public.is_super_admin());

create policy "Users can manage own notification preferences"
 on public.notification_preferences for all to authenticated
using (profile_id = (select auth.uid()) or public.has_permission(school_id, 'notifications', 'manage') or public.is_super_admin())
with check (profile_id = (select auth.uid()) or public.has_permission(school_id, 'notifications', 'manage') or public.is_super_admin());

create or replace function public.create_in_app_notification(
  target_school_id uuid,
  target_profile_id uuid,
  target_event_type text,
  target_title text,
  target_message text,
  target_entity_type text default null,
  target_entity_id uuid default null,
  target_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare notification_id uuid;
begin
  if not exists (
    select 1 from public.notification_preferences np
    where np.school_id = target_school_id
      and np.profile_id = target_profile_id
      and np.event_type = target_event_type
      and np.in_app_enabled = false
  ) then
    insert into public.notifications (school_id, recipient_profile_id, event_type, title, message, entity_type, entity_id, metadata)
    values (target_school_id, target_profile_id, target_event_type, target_title, target_message, target_entity_type, target_entity_id, coalesce(target_metadata, '{}'::jsonb))
    returning id into notification_id;
  end if;
  return notification_id;
end;
$$;

create or replace function public.mark_all_notifications_read(target_school_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare updated_count integer;
begin
  update public.notifications
  set read_at = timezone('utc', now())
  where school_id = target_school_id
    and recipient_profile_id = (select auth.uid())
    and read_at is null;
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;
