create or replace function public.is_school_backup_admin(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(public.is_super_admin(), false)
    or exists (
      select 1
      from public.user_roles as user_role
      join public.roles as assigned_role on assigned_role.id = user_role.role_id
      where user_role.user_id = (select auth.uid())
        and user_role.school_id = target_school_id
        and assigned_role.slug = 'school_admin'
        and (assigned_role.school_id = target_school_id or assigned_role.school_id is null)
    );
$$;

revoke all on function public.is_school_backup_admin(uuid) from public, anon;
grant execute on function public.is_school_backup_admin(uuid) to authenticated;

do $$
declare
  function_definition text;
  updated_definition text;
  school_permission_check constant text :=
    $needle$if not public.has_permission(target_school_id, 'school_setup', 'manage') then$needle$;
  backup_admin_check constant text :=
    $replacement$if not public.is_school_backup_admin(target_school_id) then$replacement$;
  restore_permissions_check constant text :=
    $needle$if not public.has_permission(target_school_id, 'users', 'manage')
     or not public.has_permission(target_school_id, 'roles', 'manage') then$needle$;
begin
  select pg_get_functiondef('public.export_school_backup(uuid)'::regprocedure)
  into function_definition;

  if position(school_permission_check in function_definition) = 0 then
    raise exception 'Could not find the expected school backup export permission check.';
  end if;

  updated_definition := replace(function_definition, school_permission_check, backup_admin_check);
  updated_definition := replace(
    updated_definition,
    'School settings permission required',
    'Only a Master Admin or School Admin can manage backups'
  );
  execute updated_definition;

  select pg_get_functiondef('public.restore_school_backup(uuid, jsonb)'::regprocedure)
  into function_definition;

  if position(school_permission_check in function_definition) = 0
     or position(restore_permissions_check in function_definition) = 0 then
    raise exception 'Could not find the expected school backup restore permission checks.';
  end if;

  updated_definition := replace(function_definition, school_permission_check, backup_admin_check);
  updated_definition := replace(updated_definition, restore_permissions_check, backup_admin_check);
  updated_definition := replace(
    updated_definition,
    'School settings permission required',
    'Only a Master Admin or School Admin can manage backups'
  );
  updated_definition := replace(
    updated_definition,
    'User and role management permissions required to restore a school backup',
    'Only a Master Admin or School Admin can restore a school backup'
  );
  execute updated_definition;
end;
$$;

comment on function public.export_school_backup(uuid) is
  'Exports all database rows scoped to one school; only a Master Admin or that school''s School Admin can export.';

comment on function public.restore_school_backup(uuid, jsonb) is
  'Merges school-scoped rows by primary key; only a Master Admin or that school''s School Admin can restore.';
