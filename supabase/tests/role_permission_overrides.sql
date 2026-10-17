begin;

select plan(9);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.role_permission_overrides'::regclass),
  'school permission overrides enforce RLS'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.role_permission_override_audit'::regclass),
  'permission change history enforces RLS'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'role_permission_overrides_validate'
      and not tgisinternal
  ),
  'override writes are checked by a database trigger'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'role_permission_overrides_audit'
      and not tgisinternal
  ),
  'permission changes are recorded by a database trigger'
);

select ok(
  exists (
    select 1 from pg_policies
    where tablename = 'role_permissions'
      and policyname = 'Only platform administrators can change permission defaults'
  ),
  'school-level administrators cannot mutate seeded defaults'
);

select ok(
  not has_school_access(gen_random_uuid()),
  'unknown school access is denied'
);

select ok(
  not has_permission(gen_random_uuid(), 'students', 'view'),
  'unknown school permissions are denied'
);

select is(
  (select count(*)::integer from get_effective_permissions(gen_random_uuid())),
  0,
  'effective permissions are empty for an unknown school'
);

select ok(
  not has_function_privilege('anon', 'public.get_effective_permissions(uuid)', 'EXECUTE'),
  'anonymous users cannot query effective school permissions'
);

select * from finish();

rollback;
