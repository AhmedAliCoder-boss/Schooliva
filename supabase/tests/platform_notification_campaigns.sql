begin;

select plan(6);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.platform_notification_campaigns'::regclass),
  'platform notification campaigns have RLS enabled'
);

select ok(
  exists (
    select 1 from pg_policies
    where tablename = 'platform_notification_campaigns'
      and policyname = 'Platform administrators can read notification campaigns'
  ),
  'campaign history is restricted by a Master Admin policy'
);

select ok(
  exists (
    select 1 from pg_policies
    where tablename = 'notifications'
      and policyname = 'Platform administrators can read school notifications'
  ),
  'cross-school notification reads have an explicit Master Admin policy'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.create_platform_notification_campaign(uuid[],text[],text,text)'::regprocedure),
  'campaign delivery uses a security-definer RPC'
);

select ok(
  has_function_privilege('authenticated', 'public.create_platform_notification_campaign(uuid[],text[],text,text)', 'EXECUTE'),
  'authenticated callers can invoke the RPC and are checked inside it'
);

select ok(
  not has_function_privilege('anon', 'public.create_platform_notification_campaign(uuid[],text[],text,text)', 'EXECUTE'),
  'anonymous callers cannot invoke campaign delivery'
);

select * from finish();
rollback;
