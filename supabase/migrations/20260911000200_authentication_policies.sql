create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Users can read their own school roles"
on public.user_roles for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Members can read their schools"
on public.schools for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles
    where user_roles.user_id = (select auth.uid())
      and user_roles.school_id = schools.id
  )
);

create policy "Members can read school settings"
on public.school_settings for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles
    where user_roles.user_id = (select auth.uid())
      and user_roles.school_id = school_settings.school_id
  )
);