alter table public.profiles
  add column if not exists username text;

create unique index if not exists profiles_username_key
  on public.profiles (lower(username))
  where username is not null;

with candidates as (
  select p.id,
         split_part(u.email, '@', 1) as base_username,
         count(*) over (partition by lower(split_part(u.email, '@', 1))) as base_count
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username is null
    and u.email is not null
)
update public.profiles p
set username = case
  when c.base_count = 1 and not exists (
    select 1
    from public.profiles existing
    where existing.id <> p.id
      and lower(existing.username) = lower(c.base_username)
  ) then c.base_username
  else c.base_username || '-' || left(p.id::text, 8)
end
from candidates c
where p.id = c.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'username'), '')
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        username = excluded.username;
  return new;
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
  left join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(login_identifier))
     or lower(coalesce(p.username, '')) = lower(trim(login_identifier))
     or u.id::text = trim(login_identifier)
  limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;