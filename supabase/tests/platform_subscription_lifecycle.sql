begin;

select plan(15);

select ok(
  has_function_privilege('authenticated', 'public.sync_user_school_lifecycle(uuid)', 'EXECUTE'),
  'authenticated sessions can synchronize their own expired school lifecycle'
);

select ok(
  not has_function_privilege('anon', 'public.sync_user_school_lifecycle(uuid)', 'EXECUTE'),
  'anonymous callers cannot synchronize school lifecycle state'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'platform_transactions_apply_subscription'
      and tgrelid = 'public.platform_transactions'::regclass
      and not tgisinternal
  ),
  'full platform invoice payments are connected to subscription activation'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'platform_bills_contract_period_key'
  ),
  'contract billing periods are idempotent'
);

select ok(
  position('school_subscription_access_active' in pg_get_functiondef('public.has_school_access(uuid)'::regprocedure)) > 0,
  'school data access depends on a live trial or paid subscription'
);

select ok(
  position('school_subscription_access_active' in pg_get_functiondef('public.is_account_active(uuid)'::regprocedure)) > 0,
  'login eligibility depends on at least one live school lifecycle'
);

insert into public.schools (name, slug, code, is_active)
values ('Lifecycle Test School', 'lifecycle-test-school', 'LIFECYCLE-TEST', true);

insert into public.school_trials (school_id, trial_name, status, starts_on, ends_on, seats)
select id, 'Lifecycle Test Trial', 'active', current_date, current_date + 29, 25
from public.schools where code = 'LIFECYCLE-TEST';

insert into public.platform_contracts (school_id, contract_number, plan_name, pricing_model, monthly_amount, status, start_date)
select id, '', 'Auto Number Test', 'monthly', 0, 'draft', current_date
from public.schools where code = 'LIFECYCLE-TEST';

select ok(
  (select contract_number ~ '^SC-[0-9]{2}-[0-9]{4,}$'
   from public.platform_contracts
   where plan_name = 'Auto Number Test'
     and school_id = (select id from public.schools where code = 'LIFECYCLE-TEST')),
  'blank contract references are generated as short year-based identifiers'
);

select ok(
  public.school_subscription_access_active((select id from public.schools where code = 'LIFECYCLE-TEST')),
  'an in-date active trial grants school subscription access'
);

update public.school_trials
set status = 'expired'
where school_id = (select id from public.schools where code = 'LIFECYCLE-TEST');

select ok(
  not public.school_subscription_access_active((select id from public.schools where code = 'LIFECYCLE-TEST')),
  'an expired trial without a paid contract blocks school access'
);

update public.schools set is_active = false where code = 'LIFECYCLE-TEST';
update public.school_trials
set status = 'active'
where school_id = (select id from public.schools where code = 'LIFECYCLE-TEST');

insert into public.platform_contracts (school_id, contract_number, plan_name, pricing_model, monthly_amount, status, start_date, metadata)
select id, 'CT-LIFECYCLE-TEST', 'Lifecycle Monthly', 'monthly', 100, 'draft', current_date,
       jsonb_build_object('trial_id', (select id from public.school_trials where trial_name = 'Lifecycle Test Trial' and school_id = public.schools.id))
from public.schools where code = 'LIFECYCLE-TEST';

insert into public.platform_bills (
  school_id, contract_id, bill_number, description, total_amount, due_date,
  billing_period_start, billing_period_end
)
select s.id, pc.id, 'PLT-LIFECYCLE-TEST', 'Lifecycle subscription', 100,
       current_date + 7, current_date,
       (current_date + interval '1 month' - interval '1 day')::date
from public.schools s
join public.platform_contracts pc on pc.school_id = s.id
where s.code = 'LIFECYCLE-TEST' and pc.contract_number = 'CT-LIFECYCLE-TEST';

insert into public.platform_transactions (
  school_id, bill_id, transaction_reference, amount, payment_method, transaction_date
)
select s.id, b.id, 'PT-LIFECYCLE-TEST', 100, 'bank_transfer', current_date
from public.schools s
join public.platform_bills b on b.school_id = s.id
where s.code = 'LIFECYCLE-TEST' and b.bill_number = 'PLT-LIFECYCLE-TEST';

select is(
  (select status from public.platform_contracts where contract_number = 'CT-LIFECYCLE-TEST'),
  'active',
  'full payment activates the linked contract'
);

select ok(
  (select is_active from public.schools where code = 'LIFECYCLE-TEST'),
  'full payment enables the school account'
);

select is(
  (select status from public.school_trials where trial_name = 'Lifecycle Test Trial' and school_id = (select id from public.schools where code = 'LIFECYCLE-TEST')),
  'converted',
  'full contract payment converts the trial'
);

select ok(
  not exists (
    select 1
    from public.platform_bills next_bill
    join public.platform_bills first_bill on first_bill.contract_id = next_bill.contract_id
    where first_bill.bill_number = 'PLT-LIFECYCLE-TEST'
      and next_bill.id <> first_bill.id
      and next_bill.billing_period_start = first_bill.billing_period_end + 1
      and next_bill.contract_id is not null
  ),
  'full monthly payment does not create a second invoice automatically'
);

select ok(
  (select subscription_applied_at is not null from public.platform_bills where bill_number = 'PLT-LIFECYCLE-TEST'),
  'a paid contract invoice is applied only once'
);

select ok(
  (select end_date is null and subscription_valid_until = billing_period_end
   from public.platform_contracts pc
   join public.platform_bills b on b.contract_id = pc.id
   where pc.contract_number = 'CT-LIFECYCLE-TEST' and b.bill_number = 'PLT-LIFECYCLE-TEST'),
  'paid-through access is stored separately from the signed agreement end date'
);

select * from finish();
rollback;
