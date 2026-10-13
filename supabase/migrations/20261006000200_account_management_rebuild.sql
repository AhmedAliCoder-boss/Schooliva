alter table public.profiles
  add column if not exists application_user_id text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists account_status text not null default 'active';

update public.profiles
set application_user_id = 'USER-' || upper(replace(id::text, '-', ''))
where application_user_id is null;

update public.profiles
set first_name = nullif(split_part(trim(full_name), ' ', 1), ''),
    last_name = nullif(trim(substr(trim(full_name), length(split_part(trim(full_name), ' ', 1)) + 1)), '')
where full_name is not null
  and first_name is null
  and last_name is null;

update public.profiles
set account_status = case when is_active then 'active' else 'inactive' end
where account_status is distinct from case when is_active then 'active' else 'inactive' end;

alter table public.profiles
  alter column application_user_id set default ('USER-' || upper(replace(gen_random_uuid()::text, '-', ''))),
  alter column application_user_id set not null;

create unique index if not exists profiles_application_user_id_key
  on public.profiles (lower(application_user_id));

create unique index if not exists profiles_username_key
  on public.profiles (lower(username))
  where username is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_account_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_account_status_check
      check (account_status in ('active', 'inactive', 'suspended'));
  end if;
end;
$$;

create table if not exists public.account_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  target_user_id uuid,
  school_id uuid references public.schools (id) on delete set null,
  action text not null,
  result text not null default 'success',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint account_audit_logs_result_check check (result in ('success', 'failure')),
  constraint account_audit_logs_action_check check (length(trim(action)) > 0)
);

create index if not exists account_audit_logs_target_created_idx
  on public.account_audit_logs (target_user_id, created_at desc);
create index if not exists account_audit_logs_school_created_idx
  on public.account_audit_logs (school_id, created_at desc);
create index if not exists account_audit_logs_actor_created_idx
  on public.account_audit_logs (actor_id, created_at desc);

alter table public.account_audit_logs enable row level security;

create or replace function public.sync_profile_account_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.account_status = 'active' and not new.is_active then
      new.account_status := 'inactive';
    end if;
  elsif new.account_status is distinct from old.account_status then
    new.is_active := new.account_status = 'active';
  elsif new.is_active is distinct from old.is_active then
    new.account_status := case when new.is_active then 'active' else 'inactive' end;
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_sync_account_status on public.profiles;
create trigger profiles_sync_account_status
before insert or update on public.profiles
for each row execute function public.sync_profile_account_status();

create or replace function public.is_account_active(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_user_id is not null
     and (
       target_user_id = (select auth.uid())
       or public.is_super_admin()
     )
     and exists (
       select 1
       from public.profiles p
       where p.id = target_user_id
         and p.account_status = 'active'
     );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_account_active()
     and exists (
       select 1
       from public.user_roles ur
       join public.roles r on r.id = ur.role_id
       where ur.user_id = (select auth.uid())
         and r.slug in ('super_admin', 'master_admin')
     );
$$;

create or replace function public.has_school_access(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_account_active()
     and (
       public.is_super_admin()
       or exists (
         select 1
         from public.user_roles ur
         where ur.user_id = (select auth.uid())
           and ur.school_id = target_school_id
       )
     );
$$;

create or replace function public.has_permission(target_school_id uuid, target_resource text, target_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_account_active()
     and (
       public.is_super_admin()
       or exists (
         select 1
         from public.user_roles ur
         join public.roles r on r.id = ur.role_id
         join public.role_permissions rp on rp.role_id = r.id
         join public.permissions p on p.id = rp.permission_id
         where ur.user_id = (select auth.uid())
           and ur.school_id = target_school_id
           and (r.school_id = target_school_id or r.school_id is null)
           and p.resource = target_resource
           and p.action = target_action
       )
     );
$$;

create or replace function public.can_manage_account(target_school_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_account_active()
     and (
       public.is_super_admin()
       or (
         target_school_id is not null
         and public.has_permission(target_school_id, 'users', 'manage')
         and exists (
           select 1
           from public.user_roles target_membership
           where target_membership.user_id = target_user_id
             and target_membership.school_id = target_school_id
         )
         and not exists (
           select 1
           from public.user_roles other_membership
           where other_membership.user_id = target_user_id
             and other_membership.school_id <> target_school_id
         )
         and not exists (
           select 1
           from public.user_roles ur
           join public.roles r on r.id = ur.role_id
           where ur.user_id = target_user_id
             and r.slug in ('super_admin', 'master_admin')
         )
       )
     );
$$;

create or replace function public.is_parent_of_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_account_active()
     and exists (
       select 1
       from public.student_parents sp
       join public.parents p on p.id = sp.parent_id
       where sp.student_id = target_student_id
         and p.profile_id = (select auth.uid())
         and p.school_id = sp.school_id
         and p.deleted_at is null
     );
$$;

create or replace function public.is_student_record(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_account_active()
     and exists (
       select 1
       from public.students s
       where s.id = target_student_id
         and s.profile_id = (select auth.uid())
         and s.deleted_at is null
     );
$$;

create or replace function public.write_account_audit(
  target_user_id uuid,
  target_school_id uuid,
  target_action text,
  target_result text default 'success',
  target_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_audit_id uuid;
  safe_metadata jsonb;
begin
  if auth.uid() is null or not public.is_account_active() then
    raise exception 'Not authorized to write account audit events';
  end if;

  if not (
    public.is_super_admin()
    or (target_school_id is not null and public.can_manage_account(target_school_id, target_user_id))
    or (target_user_id = auth.uid() and target_action in ('profile_updated', 'profile_photo_changed'))
  ) then
    raise exception 'Not authorized to write account audit events';
  end if;

  if target_action not in (
    'email_change_requested',
    'password_changed',
    'password_reset_initiated',
    'profile_photo_changed'
  ) then
    raise exception 'Unsupported account audit action';
  end if;

  safe_metadata := case target_action
    when 'password_changed' then jsonb_build_object('method', 'admin_set')
    when 'password_reset_initiated' then jsonb_build_object('method', 'email_recovery')
    when 'profile_photo_changed' then
      case
        when target_metadata ->> 'file_type' in ('image/jpeg', 'image/png', 'image/webp')
          then jsonb_build_object('file_type', target_metadata ->> 'file_type')
        else '{}'::jsonb
      end
    else '{}'::jsonb
  end;

  insert into public.account_audit_logs (actor_id, target_user_id, school_id, action, result, metadata)
  values (
    auth.uid(),
    target_user_id,
    target_school_id,
    trim(target_action),
    target_result,
    safe_metadata
  )
  returning id into created_audit_id;

  return created_audit_id;
end;
$$;

create or replace function public.update_own_profile(
  target_full_name text,
  target_username text,
  target_first_name text,
  target_last_name text,
  target_phone text,
  target_avatar_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_avatar_path text;
begin
  if auth.uid() is null or not public.is_account_active() then
    raise exception 'An active signed-in account is required to update this profile';
  end if;

  if target_full_name is null or length(trim(target_full_name)) not between 2 and 120 then
    raise exception 'Full name must be between 2 and 120 characters';
  end if;

  if target_username is null or target_username !~ '^[A-Za-z0-9._-]{3,30}$' then
    raise exception 'Username must be 3-30 letters, numbers, dots, dashes, or underscores';
  end if;

  if length(coalesce(target_phone, '')) > 40 then
    raise exception 'Phone number must be at most 40 characters';
  end if;

  if target_avatar_path is not null
     and left(target_avatar_path, length((select auth.uid())::text) + 1) <> (select auth.uid())::text || '/' then
    raise exception 'Profile photo path is not owned by the signed-in account';
  end if;

  select avatar_path into previous_avatar_path
  from public.profiles
  where id = (select auth.uid());

  update public.profiles
  set full_name = trim(target_full_name),
      username = trim(target_username),
      first_name = nullif(trim(target_first_name), ''),
      last_name = nullif(trim(target_last_name), ''),
      phone = nullif(trim(coalesce(target_phone, '')), ''),
      avatar_path = coalesce(target_avatar_path, avatar_path)
  where id = (select auth.uid());

  if not found then
    raise exception 'Profile does not exist';
  end if;

  insert into public.account_audit_logs (actor_id, target_user_id, action, result, metadata)
  values (
    auth.uid(),
    auth.uid(),
    'profile_updated',
    'success',
    jsonb_build_object('fields', jsonb_build_array('full_name', 'first_name', 'last_name', 'username', 'phone'))
  );

  if target_avatar_path is not null and target_avatar_path is distinct from previous_avatar_path then
    insert into public.account_audit_logs (actor_id, target_user_id, action, result, metadata)
    values (auth.uid(), auth.uid(), 'profile_photo_changed', 'success', jsonb_build_object('changed', true));
  end if;
end;
$$;

create or replace function public.update_managed_account(
  target_school_id uuid,
  target_user_id uuid,
  target_application_user_id text,
  target_username text,
  target_first_name text,
  target_last_name text,
  target_full_name text,
  target_phone text,
  target_role_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_is_platform_admin boolean;
begin
  if auth.uid() is null
     or not public.is_account_active()
     or not public.can_manage_account(target_school_id, target_user_id) then
    raise exception 'Not authorized to manage accounts in this school';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot change your own account role here';
  end if;

  if not exists (
    select 1 from public.user_roles
    where user_id = target_user_id and school_id = target_school_id
  ) then
    raise exception 'Account is not a member of this school';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = target_user_id
      and r.slug in ('super_admin', 'master_admin')
  ) into target_is_platform_admin;

  if target_is_platform_admin then
    raise exception 'Platform administrator accounts are protected';
  end if;

  if target_application_user_id is null
     or target_application_user_id !~ '^[A-Za-z0-9._-]{3,40}$' then
    raise exception 'User ID must be 3-40 letters, numbers, dots, dashes, or underscores';
  end if;

  if target_username is null
     or target_username !~ '^[A-Za-z0-9._-]{3,30}$' then
    raise exception 'Username must be 3-30 letters, numbers, dots, dashes, or underscores';
  end if;

  if target_full_name is null or length(trim(target_full_name)) not between 2 and 120 then
    raise exception 'Full name must be between 2 and 120 characters';
  end if;

  if length(coalesce(target_phone, '')) > 40 then
    raise exception 'Phone number must be at most 40 characters';
  end if;

  if not exists (
    select 1
    from public.roles
    where id = target_role_id
      and (school_id is null or school_id = target_school_id)
      and slug not in ('super_admin', 'master_admin')
  ) then
    raise exception 'Selected role is not available for this school';
  end if;

  update public.profiles
  set application_user_id = trim(target_application_user_id),
      username = trim(target_username),
      first_name = nullif(trim(target_first_name), ''),
      last_name = nullif(trim(target_last_name), ''),
      full_name = trim(target_full_name),
      phone = nullif(trim(coalesce(target_phone, '')), '')
  where id = target_user_id;

  if not found then
    raise exception 'Account profile does not exist';
  end if;

  delete from public.user_roles
  where user_id = target_user_id and school_id = target_school_id;

  insert into public.user_roles (user_id, school_id, role_id)
  values (target_user_id, target_school_id, target_role_id);

  insert into public.account_audit_logs (actor_id, target_user_id, school_id, action, result, metadata)
  values (
    auth.uid(),
    target_user_id,
    target_school_id,
    'account_updated',
    'success',
    jsonb_build_object('role_id', target_role_id)
  );
end;
$$;

create or replace function public.create_managed_account(
  target_school_id uuid,
  target_user_id uuid,
  target_application_user_id text,
  target_username text,
  target_first_name text,
  target_last_name text,
  target_full_name text,
  target_phone text,
  target_role_id uuid,
  target_account_status text default 'active'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not public.is_account_active()
     or target_school_id is null
     or not (
       public.is_super_admin()
       or public.has_permission(target_school_id, 'users', 'manage')
     ) then
    raise exception 'Not authorized to create accounts in this school';
  end if;

  if target_application_user_id is null
     or target_application_user_id !~ '^[A-Za-z0-9._-]{3,40}$' then
    raise exception 'User ID must be 3-40 letters, numbers, dots, dashes, or underscores';
  end if;

  if target_username is null
     or target_username !~ '^[A-Za-z0-9._-]{3,30}$' then
    raise exception 'Username must be 3-30 letters, numbers, dots, dashes, or underscores';
  end if;

  if target_full_name is null or length(trim(target_full_name)) not between 2 and 120 then
    raise exception 'Full name must be between 2 and 120 characters';
  end if;

  if target_account_status not in ('active', 'inactive', 'suspended') then
    raise exception 'Invalid account status';
  end if;

  if not exists (
    select 1 from public.profiles where id = target_user_id
  ) then
    raise exception 'Supabase Auth profile was not created';
  end if;

  if not exists (
    select 1
    from public.roles
    where id = target_role_id
      and (school_id is null or school_id = target_school_id)
      and slug not in ('super_admin', 'master_admin')
  ) then
    raise exception 'Selected role is not available for this school';
  end if;

  update public.profiles
  set application_user_id = trim(target_application_user_id),
      username = trim(target_username),
      first_name = nullif(trim(target_first_name), ''),
      last_name = nullif(trim(target_last_name), ''),
      full_name = trim(target_full_name),
      phone = nullif(trim(coalesce(target_phone, '')), ''),
      account_status = target_account_status
  where id = target_user_id;

  insert into public.user_roles (user_id, school_id, role_id)
  values (target_user_id, target_school_id, target_role_id);

  insert into public.account_audit_logs (actor_id, target_user_id, school_id, action, result, metadata)
  values (
    auth.uid(),
    target_user_id,
    target_school_id,
    'account_created',
    'success',
    jsonb_build_object('role_id', target_role_id, 'status', target_account_status)
  );
end;
$$;

create or replace function public.move_managed_account(
  target_user_id uuid,
  source_school_id uuid,
  destination_school_id uuid,
  destination_role_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not public.is_account_active()
     or not public.is_super_admin() then
    raise exception 'Only a Master Admin can move accounts between schools';
  end if;

  if source_school_id = destination_school_id then
    raise exception 'Source and destination schools must be different';
  end if;

  if not exists (select 1 from public.schools where id = destination_school_id) then
    raise exception 'Destination school does not exist';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = target_user_id
      and r.slug in ('super_admin', 'master_admin')
  ) then
    raise exception 'Platform administrator accounts are protected';
  end if;

  if source_school_id is not null and not exists (
    select 1 from public.user_roles
    where user_id = target_user_id and school_id = source_school_id
  ) then
    raise exception 'Account is not a member of the source school';
  end if;

  if not exists (
    select 1
    from public.roles
    where id = destination_role_id
      and (school_id is null or school_id = destination_school_id)
      and slug not in ('super_admin', 'master_admin')
  ) then
    raise exception 'Selected role is not available for the destination school';
  end if;

  if source_school_id is not null then
    delete from public.user_roles
    where user_id = target_user_id and school_id = source_school_id;
  end if;

  insert into public.user_roles (user_id, school_id, role_id)
  values (target_user_id, destination_school_id, destination_role_id)
  on conflict (user_id, school_id, role_id) do nothing;

  insert into public.account_audit_logs (actor_id, target_user_id, school_id, action, result, metadata)
  values (
    auth.uid(),
    target_user_id,
    destination_school_id,
    'school_membership_moved',
    'success',
    jsonb_build_object('source_school_id', source_school_id, 'destination_school_id', destination_school_id, 'role_id', destination_role_id)
  );
end;
$$;

create or replace function public.set_managed_account_status(
  target_user_id uuid,
  target_school_id uuid,
  target_account_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not public.is_account_active()
     or not public.can_manage_account(target_school_id, target_user_id) then
    raise exception 'Not authorized to change account status';
  end if;

  if target_account_status not in ('active', 'inactive', 'suspended') then
    raise exception 'Invalid account status';
  end if;

  if target_user_id = auth.uid() and target_account_status <> 'active' then
    raise exception 'You cannot deactivate or suspend your own account';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = target_user_id
      and r.slug in ('super_admin', 'master_admin')
  ) then
    raise exception 'Platform administrator accounts are protected';
  end if;

  update public.profiles
  set account_status = target_account_status
  where id = target_user_id;

  if not found then
    raise exception 'Account profile does not exist';
  end if;

  insert into public.account_audit_logs (actor_id, target_user_id, school_id, action, result, metadata)
  values (
    auth.uid(),
    target_user_id,
    target_school_id,
    'account_status_changed',
    'success',
    jsonb_build_object('status', target_account_status)
  );
end;
$$;

create or replace function public.list_managed_accounts(
  target_search text default null,
  target_school_id uuid default null,
  target_role_id uuid default null,
  target_status text default null,
  target_created_from date default null,
  target_created_to date default null,
  target_page integer default 1,
  target_page_size integer default 25
)
returns table (
  id uuid,
  application_user_id text,
  username text,
  first_name text,
  last_name text,
  full_name text,
  email text,
  phone text,
  avatar_path text,
  account_status text,
  profile_created_at timestamptz,
  profile_updated_at timestamptz,
  auth_created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  memberships jsonb,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_super_admin() then
    raise exception 'Only an active Master Admin can list all accounts';
  end if;

  if target_status is not null and target_status not in ('active', 'inactive', 'suspended') then
    raise exception 'Invalid account status filter';
  end if;

  return query
  with filtered as (
    select p.id,
           p.application_user_id,
           p.username,
           p.first_name,
           p.last_name,
           p.full_name,
           p.email,
           p.phone,
           p.avatar_path,
           p.account_status,
           p.created_at as profile_created_at,
           p.updated_at as profile_updated_at,
           au.created_at as auth_created_at,
           au.last_sign_in_at,
           au.email_confirmed_at,
           count(*) over () as total_count
    from public.profiles p
    join auth.users au on au.id = p.id
    where (
      nullif(trim(target_search), '') is null
      or p.id::text ilike '%' || replace(replace(trim(target_search), '%', '\%'), '_', '\_') || '%'
      or p.application_user_id ilike '%' || replace(replace(trim(target_search), '%', '\%'), '_', '\_') || '%'
      or coalesce(p.username, '') ilike '%' || replace(replace(trim(target_search), '%', '\%'), '_', '\_') || '%'
      or coalesce(p.full_name, '') ilike '%' || replace(replace(trim(target_search), '%', '\%'), '_', '\_') || '%'
      or coalesce(p.email, '') ilike '%' || replace(replace(trim(target_search), '%', '\%'), '_', '\_') || '%'
      or coalesce(p.phone, '') ilike '%' || replace(replace(trim(target_search), '%', '\%'), '_', '\_') || '%'
    )
    and (target_status is null or p.account_status = target_status)
    and (target_created_from is null or p.created_at >= target_created_from::timestamptz)
    and (target_created_to is null or p.created_at < (target_created_to + 1)::timestamptz)
    and (
      target_school_id is null
      or exists (
        select 1 from public.user_roles ur
        where ur.user_id = p.id and ur.school_id = target_school_id
      )
    )
    and (
      target_role_id is null
      or exists (
        select 1 from public.user_roles ur
        where ur.user_id = p.id and ur.role_id = target_role_id
      )
    )
  )
  select f.id,
         f.application_user_id,
         f.username,
         f.first_name,
         f.last_name,
         f.full_name,
         f.email,
         f.phone,
         f.avatar_path,
         f.account_status,
         f.profile_created_at,
         f.profile_updated_at,
         f.auth_created_at,
         f.last_sign_in_at,
         f.email_confirmed_at,
         coalesce((
           select jsonb_agg(
             jsonb_build_object(
               'school_id', s.id,
               'school_name', s.name,
               'role_id', r.id,
               'role_name', r.name,
               'role_slug', r.slug
             )
             order by s.name, r.name
           )
           from public.user_roles ur
           join public.schools s on s.id = ur.school_id
           join public.roles r on r.id = ur.role_id
           where ur.user_id = f.id
         ), '[]'::jsonb),
         f.total_count
  from filtered f
  order by f.profile_created_at desc, f.id
  limit greatest(1, least(coalesce(target_page_size, 25), 100))
  offset (greatest(1, coalesce(target_page, 1)) - 1) * greatest(1, least(coalesce(target_page_size, 25), 100));
end;
$$;

create or replace function public.get_account_management_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_super_admin() then
    raise exception 'Only an active Master Admin can view global account statistics';
  end if;

  return jsonb_build_object(
    'total_accounts', (select count(*) from public.profiles),
    'active_accounts', (select count(*) from public.profiles where account_status = 'active'),
    'inactive_accounts', (select count(*) from public.profiles where account_status = 'inactive'),
    'suspended_accounts', (select count(*) from public.profiles where account_status = 'suspended'),
    'accounts_by_school', (
      select coalesce(jsonb_agg(jsonb_build_object('school_id', s.id, 'school_name', s.name, 'count', school_counts.account_count) order by s.name), '[]'::jsonb)
      from public.schools s
      left join (
        select ur.school_id, count(distinct ur.user_id) as account_count
        from public.user_roles ur
        join public.profiles p on p.id = ur.user_id
        group by ur.school_id
      ) school_counts on school_counts.school_id = s.id
    ),
    'accounts_by_role', (
      select coalesce(jsonb_agg(jsonb_build_object('role_id', r.id, 'role_name', r.name, 'school_id', r.school_id, 'count', role_counts.account_count) order by r.name), '[]'::jsonb)
      from public.roles r
      left join (
        select ur.role_id, ur.school_id, count(distinct ur.user_id) as account_count
        from public.user_roles ur
        group by ur.role_id, ur.school_id
      ) role_counts on role_counts.role_id = r.id and role_counts.school_id is not distinct from r.school_id
    ),
    'recent_created', (
      select coalesce(jsonb_agg(jsonb_build_object('id', recent.id, 'full_name', recent.full_name, 'created_at', recent.created_at) order by recent.created_at desc), '[]'::jsonb)
      from (select id, full_name, created_at from public.profiles order by created_at desc limit 5) recent
    ),
    'recent_updated', (
      select coalesce(jsonb_agg(jsonb_build_object('id', recent.id, 'full_name', recent.full_name, 'updated_at', recent.updated_at) order by recent.updated_at desc), '[]'::jsonb)
      from (select id, full_name, updated_at from public.profiles order by updated_at desc limit 5) recent
    ),
    'recent_security_events', (
      select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'target_user_id', e.target_user_id, 'action', e.action, 'result', e.result, 'created_at', e.created_at) order by e.created_at desc), '[]'::jsonb)
      from (select id, target_user_id, action, result, created_at from public.account_audit_logs order by created_at desc limit 10) e
    )
  );
end;
$$;

create or replace function public.resolve_login_email(login_identifier text)
returns text
language sql
security definer
set search_path = public
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.account_status = 'active'
    and (
      lower(u.email) = lower(trim(login_identifier))
      or lower(coalesce(p.username, '')) = lower(trim(login_identifier))
      or lower(p.application_user_id) = lower(trim(login_identifier))
    )
  limit 1;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata_name text;
begin
  metadata_name := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');

  insert into public.profiles (id, full_name, first_name, last_name, username, email)
  values (
    new.id,
    metadata_name,
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    new.email
  )
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        first_name = coalesce(excluded.first_name, public.profiles.first_name),
        last_name = coalesce(excluded.last_name, public.profiles.last_name),
        username = coalesce(excluded.username, public.profiles.username),
        email = excluded.email;

  return new;
end;
$$;

revoke all on function public.is_account_active(uuid) from public;
grant execute on function public.is_account_active(uuid) to authenticated;
revoke all on function public.can_manage_account(uuid, uuid) from public;
grant execute on function public.can_manage_account(uuid, uuid) to authenticated;
revoke all on function public.write_account_audit(uuid, uuid, text, text, jsonb) from public;
grant execute on function public.write_account_audit(uuid, uuid, text, text, jsonb) to authenticated;
revoke all on function public.update_own_profile(text, text, text, text, text, text) from public;
grant execute on function public.update_own_profile(text, text, text, text, text, text) to authenticated;
revoke all on function public.update_managed_account(uuid, uuid, text, text, text, text, text, text, uuid) from public;
grant execute on function public.update_managed_account(uuid, uuid, text, text, text, text, text, text, uuid) to authenticated;
revoke all on function public.create_managed_account(uuid, uuid, text, text, text, text, text, text, uuid, text) from public;
grant execute on function public.create_managed_account(uuid, uuid, text, text, text, text, text, text, uuid, text) to authenticated;
revoke all on function public.move_managed_account(uuid, uuid, uuid, uuid) from public;
grant execute on function public.move_managed_account(uuid, uuid, uuid, uuid) to authenticated;
revoke all on function public.set_managed_account_status(uuid, uuid, text) from public;
grant execute on function public.set_managed_account_status(uuid, uuid, text) to authenticated;
revoke all on function public.list_managed_accounts(text, uuid, uuid, text, date, date, integer, integer) from public;
grant execute on function public.list_managed_accounts(text, uuid, uuid, text, date, date, integer, integer) to authenticated;
revoke all on function public.get_account_management_summary() from public;
grant execute on function public.get_account_management_summary() to authenticated;
revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to service_role;

drop policy if exists "Master admins can read account audit logs" on public.account_audit_logs;
create policy "Master admins can read account audit logs"
on public.account_audit_logs for select to authenticated
using (public.is_super_admin());

drop policy if exists "School account managers can read scoped account audit logs" on public.account_audit_logs;
create policy "School account managers can read scoped account audit logs"
on public.account_audit_logs for select to authenticated
using (
  school_id is not null
  and public.has_permission(school_id, 'users', 'manage')
);

revoke update on public.profiles from public, anon, authenticated;
do $$
declare
  profile_columns text;
begin
  select string_agg(format('%I', attname), ',')
  into profile_columns
  from pg_attribute
  where attrelid = 'public.profiles'::regclass
    and attnum > 0
    and not attisdropped;

  if profile_columns is not null then
    execute format('revoke update (%s) on public.profiles from public, anon, authenticated', profile_columns);
  end if;
end;
$$;
grant update (full_name, phone, avatar_path) on public.profiles to authenticated;

drop policy if exists "Users can read their own profile photos" on storage.objects;
create policy "Users and authorized admins can read profile photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_super_admin()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id::text = (storage.foldername(name))[1]
        and public.has_permission(ur.school_id, 'users', 'manage')
    )
  )
);

drop policy if exists "Users can upload their own profile photos" on storage.objects;
create policy "Users and authorized admins can upload profile photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_super_admin()
  )
);

drop policy if exists "Users can update their own profile photos" on storage.objects;
create policy "Users and authorized admins can update profile photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_super_admin()
  )
)
with check (
  bucket_id = 'profile-avatars'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_super_admin()
  )
);

drop policy if exists "Users can delete their own profile photos" on storage.objects;
create policy "Users and authorized admins can delete profile photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_super_admin()
  )
);
