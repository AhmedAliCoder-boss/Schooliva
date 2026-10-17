create table public.role_permission_overrides (
  school_id uuid not null references public.schools (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  granted boolean not null,
  changed_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (school_id, role_id, permission_id)
);

create index role_permission_overrides_role_idx
  on public.role_permission_overrides (school_id, role_id);

create table public.role_permission_override_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  role_id uuid references public.roles (id) on delete set null,
  role_name text not null,
  role_slug text not null,
  permission_resource text not null,
  permission_action text not null,
  old_granted boolean,
  new_granted boolean,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index role_permission_override_audit_recent_idx
  on public.role_permission_override_audit (school_id, created_at desc);

alter table public.role_permission_overrides enable row level security;
alter table public.role_permission_override_audit enable row level security;

grant select, insert, update, delete on public.role_permission_overrides to authenticated;
grant select on public.role_permission_override_audit to authenticated;

create or replace function public.validate_role_permission_override()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role public.roles%rowtype;
  target_permission public.permissions%rowtype;
  target_school_id uuid;
  target_role_id uuid;
  target_permission_id uuid;
begin
  if tg_op = 'DELETE' then
    target_school_id := old.school_id;
    target_role_id := old.role_id;
    target_permission_id := old.permission_id;
  else
    target_school_id := new.school_id;
    target_role_id := new.role_id;
    target_permission_id := new.permission_id;
  end if;

  if not public.has_school_access(target_school_id)
     or not (public.is_super_admin() or public.has_permission(target_school_id, 'roles', 'manage')) then
    raise exception 'Permission change is not authorized';
  end if;

  select * into target_role
  from public.roles
  where id = target_role_id;

  if not found
     or (target_role.school_id is not null and target_role.school_id <> target_school_id)
     or target_role.slug in ('super_admin', 'master_admin', 'school_admin', 'principal') then
    raise exception 'This role cannot be changed in the school permission matrix';
  end if;

  select * into target_permission
  from public.permissions
  where id = target_permission_id;

  if not found
     or target_permission.resource like 'admin.%'
     or target_permission.resource in ('roles', 'permissions', 'users') then
    raise exception 'Platform and permission-administration access cannot be delegated here';
  end if;

  if exists (
    select 1
    from public.user_roles assignment
    where assignment.user_id = (select auth.uid())
      and assignment.school_id = target_school_id
      and assignment.role_id = target_role_id
  ) then
    raise exception 'Users cannot change permissions for a role assigned to themselves';
  end if;

  if tg_op <> 'DELETE' and new.granted
     and not public.is_super_admin()
     and not public.has_permission(target_school_id, target_permission.resource, target_permission.action) then
    raise exception 'A permission cannot be delegated beyond the actor''s authority';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  new.changed_by := (select auth.uid());
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger role_permission_overrides_validate
before insert or update or delete on public.role_permission_overrides
for each row execute function public.validate_role_permission_override();

create or replace function public.audit_role_permission_override()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_row public.roles%rowtype;
  permission_row public.permissions%rowtype;
begin
  select * into role_row from public.roles where id = coalesce(new.role_id, old.role_id);
  select * into permission_row from public.permissions where id = coalesce(new.permission_id, old.permission_id);

  insert into public.role_permission_override_audit (
    school_id, role_id, role_name, role_slug, permission_resource, permission_action,
    old_granted, new_granted, actor_id
  )
  values (
    coalesce(new.school_id, old.school_id),
    coalesce(new.role_id, old.role_id),
    coalesce(role_row.name, 'Deleted role'),
    coalesce(role_row.slug, 'deleted'),
    coalesce(permission_row.resource, 'deleted'),
    coalesce(permission_row.action, 'deleted'),
    case when tg_op = 'INSERT' then null else old.granted end,
    case when tg_op = 'DELETE' then null else new.granted end,
    (select auth.uid())
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger role_permission_overrides_audit
after insert or update or delete on public.role_permission_overrides
for each row execute function public.audit_role_permission_override();

create policy "Authorized administrators can view school permission overrides"
on public.role_permission_overrides for select to authenticated
using (public.is_super_admin() or public.has_permission(school_id, 'roles', 'manage'));

create policy "Authorized administrators can add school permission overrides"
on public.role_permission_overrides for insert to authenticated
with check (public.is_super_admin() or public.has_permission(school_id, 'roles', 'manage'));

create policy "Authorized administrators can update school permission overrides"
on public.role_permission_overrides for update to authenticated
using (public.is_super_admin() or public.has_permission(school_id, 'roles', 'manage'))
with check (public.is_super_admin() or public.has_permission(school_id, 'roles', 'manage'));

create policy "Authorized administrators can restore school permission defaults"
on public.role_permission_overrides for delete to authenticated
using (public.is_super_admin() or public.has_permission(school_id, 'roles', 'manage'));

create policy "Authorized administrators can review permission change history"
on public.role_permission_override_audit for select to authenticated
using (public.is_super_admin() or public.has_permission(school_id, 'roles', 'manage'));

drop policy if exists "Authorized users can manage role permissions" on public.role_permissions;
create policy "Role members can read permission defaults"
on public.role_permissions for select to authenticated
using (
  exists (
    select 1 from public.roles role_row
    where role_row.id = role_id
      and (
        public.is_super_admin()
        or role_row.school_id is null
        or public.has_school_access(role_row.school_id)
      )
  )
);

create policy "Only platform administrators can change permission defaults"
on public.role_permissions for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create or replace function public.has_permission(target_school_id uuid, target_resource text, target_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_school_access(target_school_id)
    and (
      public.is_super_admin()
      or (
        not exists (
          select 1
          from public.user_roles assignment
          join public.role_permission_overrides override
            on override.school_id = assignment.school_id
           and override.role_id = assignment.role_id
          join public.permissions permission on permission.id = override.permission_id
          where assignment.user_id = (select auth.uid())
            and assignment.school_id = target_school_id
            and permission.resource = target_resource
            and permission.action = target_action
            and not override.granted
        )
        and exists (
          select 1
          from public.user_roles assignment
          join public.roles assigned_role on assigned_role.id = assignment.role_id
          left join public.role_permissions default_permission
            on default_permission.role_id = assigned_role.id
          left join public.permissions default_record
            on default_record.id = default_permission.permission_id
          left join public.role_permission_overrides override
            on override.school_id = assignment.school_id
           and override.role_id = assignment.role_id
          left join public.permissions override_record
            on override_record.id = override.permission_id
          where assignment.user_id = (select auth.uid())
            and assignment.school_id = target_school_id
            and (assigned_role.school_id = target_school_id or assigned_role.school_id is null)
            and (
              (default_record.resource = target_resource and default_record.action = target_action)
              or (override.granted and override_record.resource = target_resource and override_record.action = target_action)
            )
        )
      )
    );
$$;

create or replace function public.get_effective_permissions(target_school_id uuid)
returns table(resource text, action text)
language sql
stable
security definer
set search_path = public
as $$
  select permission.resource, permission.action
  from public.permissions permission
  where public.has_permission(target_school_id, permission.resource, permission.action);
$$;

revoke all on function public.get_effective_permissions(uuid) from public, anon;
grant execute on function public.get_effective_permissions(uuid) to authenticated;
