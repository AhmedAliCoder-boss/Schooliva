create table public.platform_notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  title text not null,
  message text not null,
  role_slugs text[] not null,
  school_ids uuid[] not null,
  recipient_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  check (length(trim(title)) between 1 and 160),
  check (length(trim(message)) between 1 and 1200),
  check (cardinality(role_slugs) > 0),
  check (cardinality(school_ids) > 0),
  check (recipient_count >= 0)
);

alter table public.platform_notification_campaigns enable row level security;

create policy "Platform administrators can read notification campaigns"
on public.platform_notification_campaigns for select to authenticated
using (public.is_super_admin());

grant select on public.platform_notification_campaigns to authenticated;
revoke insert, update, delete on public.platform_notification_campaigns from authenticated;

create policy "Platform administrators can read school notifications"
on public.notifications for select to authenticated
using (public.is_super_admin());

create index notifications_platform_campaign_id_idx
  on public.notifications ((metadata ->> 'platform_campaign_id'))
  where metadata ? 'platform_campaign_id';

create or replace function public.get_platform_notification_audience(target_school_ids uuid[])
returns table (school_id uuid, role_slug text, role_name text, recipient_count bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized to view platform notification audiences';
  end if;
  if coalesce(cardinality(target_school_ids), 0) = 0 then
    return;
  end if;

  return query
  select user_roles.school_id, roles.slug, roles.name, count(distinct user_roles.user_id)
  from public.user_roles
  join public.roles on roles.id = user_roles.role_id
  join public.profiles on profiles.id = user_roles.user_id and profiles.is_active
  join public.schools on schools.id = user_roles.school_id and schools.is_active
  where user_roles.school_id = any(target_school_ids)
    and not exists (
      select 1
      from public.notification_preferences
      where notification_preferences.school_id = user_roles.school_id
        and notification_preferences.profile_id = user_roles.user_id
        and notification_preferences.event_type = 'announcement'
        and notification_preferences.in_app_enabled = false
    )
  group by user_roles.school_id, roles.slug, roles.name
  order by roles.name, user_roles.school_id;
end;
$$;

revoke all on function public.get_platform_notification_audience(uuid[]) from public;
grant execute on function public.get_platform_notification_audience(uuid[]) to authenticated;

create or replace function public.create_platform_notification_campaign(
  target_school_ids uuid[],
  target_role_slugs text[],
  target_title text,
  target_message text
)
returns table (campaign_id uuid, school_count integer, recipient_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_campaign_id uuid := gen_random_uuid();
  active_school_count integer;
  inserted_count integer;
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized to send platform notifications';
  end if;
  if coalesce(cardinality(target_school_ids), 0) = 0
     or coalesce(cardinality(target_role_slugs), 0) = 0
     or length(trim(coalesce(target_title, ''))) not between 1 and 160
     or length(trim(coalesce(target_message, ''))) not between 1 and 1200 then
    raise exception 'Notification audience and content are required';
  end if;

  select count(*) into active_school_count
  from public.schools
  where id = any(target_school_ids) and is_active;

  if active_school_count <> (select count(distinct school_id) from unnest(target_school_ids) as school_ids(school_id)) then
    raise exception 'One or more selected schools are no longer active';
  end if;

  insert into public.platform_notification_campaigns (id, created_by, title, message, role_slugs, school_ids)
  values (new_campaign_id, (select auth.uid()), trim(target_title), trim(target_message), target_role_slugs, target_school_ids);

  insert into public.notifications (
    school_id, recipient_profile_id, event_type, title, message, metadata
  )
  select recipients.school_id,
    recipients.user_id,
    'announcement',
    trim(target_title),
    trim(target_message),
    jsonb_build_object(
      'audience_roles', to_jsonb(target_role_slugs),
      'platform_campaign_id', new_campaign_id
    )
  from (
    select distinct user_roles.school_id, user_roles.user_id
    from public.user_roles
    join public.roles on roles.id = user_roles.role_id
    join public.profiles on profiles.id = user_roles.user_id and profiles.is_active
    where user_roles.school_id = any(target_school_ids)
      and roles.slug = any(target_role_slugs)
      and exists (select 1 from public.schools where schools.id = user_roles.school_id and schools.is_active)
      and not exists (
        select 1
        from public.notification_preferences
        where notification_preferences.school_id = user_roles.school_id
          and notification_preferences.profile_id = user_roles.user_id
          and notification_preferences.event_type = 'announcement'
          and notification_preferences.in_app_enabled = false
      )
  ) as recipients;

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    raise exception 'No eligible recipients were found for this campaign';
  end if;

  update public.platform_notification_campaigns
  set recipient_count = inserted_count
  where id = new_campaign_id;

  return query select new_campaign_id, active_school_count, inserted_count;
end;
$$;

revoke all on function public.create_platform_notification_campaign(uuid[], text[], text, text) from public;
grant execute on function public.create_platform_notification_campaign(uuid[], text[], text, text) to authenticated;

create or replace function public.get_platform_notification_campaign_metrics(target_campaign_ids uuid[])
returns table (campaign_id uuid, sent_count bigint, read_count bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized to view platform notification metrics';
  end if;

  return query
  select campaigns.id,
    count(notifications.id),
    count(notifications.id) filter (where notifications.read_at is not null)
  from public.platform_notification_campaigns as campaigns
  left join public.notifications
    on notifications.metadata ->> 'platform_campaign_id' = campaigns.id::text
  where campaigns.id = any(coalesce(target_campaign_ids, '{}'::uuid[]))
  group by campaigns.id;
end;
$$;

revoke all on function public.get_platform_notification_campaign_metrics(uuid[]) from public;
grant execute on function public.get_platform_notification_campaign_metrics(uuid[]) to authenticated;
