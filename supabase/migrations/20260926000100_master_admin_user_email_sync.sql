alter table public.profiles
  add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.email)
  on conflict (id) do update
    set full_name = coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), public.profiles.full_name),
        email = new.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.sync_profile_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set full_name = coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), public.profiles.full_name),
         email = new.email
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update on auth.users
for each row execute function public.sync_profile_identity();

create policy "Super admins can read all profiles"
on public.profiles for select to authenticated
using (public.is_super_admin());

create policy "Super admins can update all profiles"
on public.profiles for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());
