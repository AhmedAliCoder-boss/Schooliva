insert into public.permissions (resource, action, description)
select domains.resource, actions.action, domains.description || ' (' || actions.action || ')'
from (values
  ('admin.dashboard', 'View global Schooliva platform overview'),
  ('admin.schools', 'Manage Schooliva school tenants'),
  ('admin.contracts', 'Manage platform school contracts'),
  ('admin.trials', 'Manage platform school trials'),
  ('admin.billing', 'View and manage global billing'),
  ('admin.payments', 'View and manage global payments'),
  ('admin.storage', 'View global storage usage'),
  ('admin.accounts', 'Manage school accounts'),
  ('admin.reports', 'View platform reports'),
  ('admin.activity', 'View global platform activity'),
  ('admin.settings', 'Manage platform settings')
) as domains(resource, description)
cross join (values ('view'), ('create'), ('update'), ('delete'), ('manage')) as actions(action)
on conflict (resource, action) do update
set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select role_row.id, permission_row.id
from public.roles role_row
join public.permissions permission_row on permission_row.resource like 'admin.%'
where role_row.school_id is null
  and role_row.slug = 'super_admin'
on conflict do nothing;

create or replace function public.has_permission(target_school_id uuid, target_resource text, target_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
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
    );
$$;
