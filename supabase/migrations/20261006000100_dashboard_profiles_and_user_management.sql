insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into public.role_permissions (role_id, permission_id)
select role_row.id, permission_row.id
from public.roles role_row
join public.permissions permission_row
  on permission_row.resource = 'users'
 and permission_row.action = 'manage'
where role_row.school_id is null
  and role_row.slug = 'principal'
on conflict do nothing;

create policy "Users can read their own profile photos"
on storage.objects for select to authenticated
using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload their own profile photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can update their own profile photos"
on storage.objects for update to authenticated
using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own profile photos"
on storage.objects for delete to authenticated
using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.update_school_user_profile(
  target_school_id uuid,
  target_user_id uuid,
  target_full_name text,
  target_username text,
  target_phone text,
  target_role_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not (public.is_super_admin() or public.has_permission(target_school_id, 'users', 'manage')) then
    raise exception 'Not authorized to manage accounts in this school';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot change your own school role here';
  end if;

  if target_full_name is null or length(trim(target_full_name)) < 2 or length(trim(target_full_name)) > 120 then
    raise exception 'Full name must be between 2 and 120 characters';
  end if;

  if target_username is null or target_username !~ '^[A-Za-z0-9._-]{3,30}$' then
    raise exception 'Username must be 3-30 letters, numbers, dots, dashes, or underscores';
  end if;

  if not exists (
    select 1 from public.user_roles
    where user_id = target_user_id and school_id = target_school_id
  ) then
    raise exception 'Account is not a member of this school';
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

  if not exists (
    select 1 from public.roles
    where id = target_role_id
      and (school_id is null or school_id = target_school_id)
      and slug not in ('super_admin', 'master_admin')
  ) then
    raise exception 'Selected role is not available for this school';
  end if;

  update public.profiles
  set full_name = trim(target_full_name),
      username = trim(target_username),
      phone = nullif(trim(coalesce(target_phone, '')), '')
  where id = target_user_id;

  delete from public.user_roles
  where user_id = target_user_id and school_id = target_school_id;

  insert into public.user_roles (user_id, school_id, role_id)
  values (target_user_id, target_school_id, target_role_id);
end;
$$;

revoke all on function public.update_school_user_profile(uuid, uuid, text, text, text, uuid) from public;
grant execute on function public.update_school_user_profile(uuid, uuid, text, text, text, uuid) to authenticated;
