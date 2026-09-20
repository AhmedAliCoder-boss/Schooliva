create or replace function public.bootstrap_school(
  school_name text,
  school_slug text,
  school_code text,
  school_email text default null,
  school_phone text default null,
  school_timezone text default 'UTC',
  school_currency text default 'USD'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_school_id uuid;
  principal_role_id uuid;
  requested_role text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if exists (select 1 from public.user_roles where user_id = current_user_id) then
    raise exception 'User already belongs to a school';
  end if;

  select raw_user_meta_data ->> 'requested_role'
    into requested_role
    from auth.users
   where id = current_user_id;

  if coalesce(requested_role, '') <> 'principal' then
    raise exception 'Only principal accounts can create a school workspace';
  end if;

  insert into public.schools (name, slug, code, email, phone, created_by)
  values (trim(school_name), lower(trim(school_slug)), upper(trim(school_code)), school_email, school_phone, current_user_id)
  returning id into new_school_id;

  insert into public.school_settings (school_id, timezone, currency_code)
  values (new_school_id, coalesce(nullif(trim(school_timezone), ''), 'UTC'), upper(coalesce(nullif(trim(school_currency), ''), 'USD')));

  select id into principal_role_id from public.roles where school_id is null and slug = 'principal';
  if principal_role_id is null then
    raise exception 'Principal role is not configured';
  end if;

  insert into public.user_roles (user_id, school_id, role_id)
  values (current_user_id, new_school_id, principal_role_id);

  return new_school_id;
end;
$$;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.school_id is null
  and r.slug = 'principal'
  and p.resource = 'school_settings'
  and p.action = 'manage'
on conflict do nothing;