create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  requester_profile_id uuid not null references public.profiles (id) on delete restrict,
  requester_name text not null,
  requester_email text not null,
  category text not null check (category in ('complaint', 'issue', 'feature_request', 'policy_question', 'account_access', 'billing', 'other')),
  priority text not null default 'normal' check (priority in ('normal', 'high', 'urgent')),
  subject text not null check (length(trim(subject)) between 3 and 160),
  description text not null check (length(trim(description)) between 10 and 5000),
  status text not null default 'open' check (status in ('open', 'in_review', 'planned', 'in_progress', 'resolved', 'declined')),
  admin_response text check (admin_response is null or length(admin_response) <= 3000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index support_requests_status_created_idx on public.support_requests (status, created_at desc);
create index support_requests_school_created_idx on public.support_requests (school_id, created_at desc);

create trigger support_requests_set_updated_at
before update on public.support_requests
for each row execute function public.set_updated_at();

alter table public.support_requests enable row level security;

create policy "School leaders and platform admins can read support requests"
on public.support_requests for select to authenticated
using (
  public.is_super_admin()
  or (
    public.has_school_access(school_id)
    and exists (
      select 1
      from public.user_roles
      join public.roles on roles.id = user_roles.role_id
      where user_roles.user_id = (select auth.uid())
        and user_roles.school_id = support_requests.school_id
        and roles.slug in ('school_admin', 'principal')
    )
  )
);

grant select on public.support_requests to authenticated;
revoke insert, update, delete on public.support_requests from authenticated;

create or replace function public.create_school_support_request(
  target_school_id uuid,
  target_category text,
  target_priority text,
  target_subject text,
  target_description text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_request_id uuid;
  requester_display_name text;
  requester_email text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to create a support request';
  end if;

  if not exists (
    select 1
    from public.user_roles
    join public.roles on roles.id = user_roles.role_id
    where user_roles.user_id = (select auth.uid())
      and user_roles.school_id = target_school_id
      and roles.slug in ('school_admin', 'principal')
  ) then
    raise exception 'Only school administrators and principals can create support requests';
  end if;

  if target_category not in ('complaint', 'issue', 'feature_request', 'policy_question', 'account_access', 'billing', 'other')
    or target_priority not in ('normal', 'high', 'urgent')
    or length(trim(coalesce(target_subject, ''))) not between 3 and 160
    or length(trim(coalesce(target_description, ''))) not between 10 and 5000 then
    raise exception 'Support request details are invalid';
  end if;

  select coalesce(nullif(trim(profiles.full_name), ''), 'School administrator')
  into requester_display_name
  from public.profiles
  where profiles.id = (select auth.uid());

  requester_email := coalesce((select auth.jwt() ->> 'email'), '');

  insert into public.support_requests (
    school_id, requester_profile_id, requester_name, requester_email,
    category, priority, subject, description
  )
  values (
    target_school_id, (select auth.uid()), requester_display_name, requester_email,
    target_category, target_priority, trim(target_subject), trim(target_description)
  )
  returning id into new_request_id;

  return new_request_id;
end;
$$;

revoke all on function public.create_school_support_request(uuid, text, text, text, text) from public;
grant execute on function public.create_school_support_request(uuid, text, text, text, text) to authenticated;

create or replace function public.review_school_support_request(
  target_request_id uuid,
  target_status text,
  target_admin_response text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record public.support_requests%rowtype;
begin
  if not public.is_super_admin() then
    raise exception 'Only platform administrators can review support requests';
  end if;

  if target_status not in ('open', 'in_review', 'planned', 'in_progress', 'resolved', 'declined')
    or length(coalesce(target_admin_response, '')) > 3000 then
    raise exception 'Support review details are invalid';
  end if;

  update public.support_requests
  set status = target_status,
      admin_response = nullif(trim(target_admin_response), ''),
      reviewed_by = (select auth.uid()),
      reviewed_at = timezone('utc', now())
  where id = target_request_id
  returning * into request_record;

  if not found then
    raise exception 'Support request was not found';
  end if;

  insert into public.notifications (
    school_id, recipient_profile_id, event_type, title, message,
    entity_type, entity_id, metadata
  )
  values (
    request_record.school_id,
    request_record.requester_profile_id,
    'support_update',
    'Support request updated',
    'Your request "' || request_record.subject || '" is now ' || replace(request_record.status, '_', ' ') || '.'
      || case when request_record.admin_response is not null then ' ' || request_record.admin_response else '' end,
    'support_requests',
    request_record.id,
    jsonb_build_object('status', request_record.status)
  );
end;
$$;

revoke all on function public.review_school_support_request(uuid, text, text) from public;
grant execute on function public.review_school_support_request(uuid, text, text) to authenticated;

insert into public.permissions (resource, action, description)
values
  ('support', 'view', 'Access the school support center'),
  ('support', 'manage', 'Create school support requests')
on conflict (resource, action) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.roles
cross join public.permissions
where roles.slug in ('school_admin', 'principal')
  and permissions.resource = 'support'
  and permissions.action in ('view', 'manage')
on conflict do nothing;
