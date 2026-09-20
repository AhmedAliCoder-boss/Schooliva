-- Backfill exam permissions for school-scoped role records created before exam RBAC was seeded.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.slug in ('school_admin', 'principal', 'teacher')
  and p.resource = 'exams'
  and (
    (r.slug in ('school_admin', 'principal') and p.action in ('view', 'manage'))
    or (r.slug = 'teacher' and p.action = 'view')
  )
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.slug in ('school_admin', 'principal')
  and p.resource = 'grading'
  and p.action = 'manage'
on conflict do nothing;
