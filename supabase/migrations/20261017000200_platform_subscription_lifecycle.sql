alter table public.platform_bills
  add column if not exists contract_id uuid references public.platform_contracts (id) on delete set null,
  add column if not exists billing_period_start date,
  add column if not exists billing_period_end date,
  add column if not exists subscription_applied_at timestamptz;

alter table public.platform_contracts
  add column if not exists subscription_valid_until date;

update public.platform_contracts
set subscription_valid_until = coalesce(end_date, renewal_date)
where status = 'active'
  and subscription_valid_until is null
  and coalesce(end_date, renewal_date) is not null;

create unique index if not exists platform_bills_contract_period_key
  on public.platform_bills (contract_id, billing_period_start)
  where contract_id is not null and billing_period_start is not null;

create index if not exists platform_bills_contract_due_idx
  on public.platform_bills (contract_id, due_date)
  where contract_id is not null;

update public.school_trials
set status = 'active'
where status = 'pending'
  and trial_name = 'Onboarding Trial'
  and starts_on <= current_date
  and ends_on >= current_date;

create or replace function public.school_subscription_access_active(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.schools s
    where s.id = target_school_id
      and s.is_active
      and (
        exists (
          select 1
          from public.school_trials st
          where st.school_id = s.id
            and st.status = 'active'
            and st.starts_on <= current_date
            and st.ends_on >= current_date
        )
        or exists (
          select 1
          from public.platform_contracts pc
          where pc.school_id = s.id
            and pc.status = 'active'
            and pc.start_date <= current_date
            and (coalesce(pc.subscription_valid_until, pc.end_date) is null or coalesce(pc.subscription_valid_until, pc.end_date) >= current_date)
        )
      )
  );
$$;

create or replace function public.is_account_active(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_user_id is not null
     and target_user_id = (select auth.uid())
     and exists (
       select 1
       from public.profiles p
       where p.id = target_user_id
         and p.account_status = 'active'
     )
     and (
       exists (
         select 1
         from public.user_roles ur
         join public.roles r on r.id = ur.role_id
         where ur.user_id = target_user_id
           and r.slug in ('super_admin', 'master_admin')
       )
       or not exists (
         select 1
         from public.user_roles ur
         where ur.user_id = target_user_id
       )
       or exists (
         select 1
         from public.user_roles ur
         where ur.user_id = target_user_id
           and public.school_subscription_access_active(ur.school_id)
       )
     );
$$;

create or replace function public.has_school_access(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_account_active()
     and (
       public.is_super_admin()
       or (
         public.school_subscription_access_active(target_school_id)
         and exists (
           select 1
           from public.user_roles ur
           where ur.user_id = (select auth.uid())
             and ur.school_id = target_school_id
         )
       )
     );
$$;

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
       )
     );
$$;

create or replace function public.sync_user_school_lifecycle(target_user_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  is_platform_admin boolean;
begin
  if target_user_id is null or target_user_id <> (select auth.uid()) then
    raise exception 'Users may only synchronize their own school access';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = target_user_id
      and r.slug in ('super_admin', 'master_admin')
  )
  into is_platform_admin;

  update public.school_trials st
  set status = 'expired'
  where st.status = 'active'
    and st.ends_on < current_date
    and (is_platform_admin or exists (
      select 1 from public.user_roles ur
      where ur.user_id = target_user_id and ur.school_id = st.school_id
    ));

  update public.platform_contracts pc
  set status = 'expired'
  where pc.status = 'active'
    and coalesce(pc.subscription_valid_until, pc.end_date) < current_date
    and (is_platform_admin or exists (
      select 1 from public.user_roles ur
      where ur.user_id = target_user_id and ur.school_id = pc.school_id
    ));

  update public.schools s
  set is_active = false
  where s.is_active
    and (is_platform_admin or exists (
      select 1 from public.user_roles ur
      where ur.user_id = target_user_id and ur.school_id = s.id
    ))
    and not exists (
      select 1 from public.platform_contracts pc
      where pc.school_id = s.id
        and pc.status = 'active'
        and pc.start_date <= current_date
        and (coalesce(pc.subscription_valid_until, pc.end_date) is null or coalesce(pc.subscription_valid_until, pc.end_date) >= current_date)
    )
    and not exists (
      select 1 from public.school_trials st
      where st.school_id = s.id
        and st.status = 'active'
        and st.starts_on <= current_date
        and st.ends_on >= current_date
    );
end;
$$;

create or replace function public.apply_platform_subscription_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bill_row public.platform_bills%rowtype;
  contract_row public.platform_contracts%rowtype;
  total_paid numeric(12,2);
  period_start date;
  period_end date;
  next_period_start date;
  next_period_end date;
  next_due_date date;
  cycle_months integer;
  invoice_amount numeric(12,2);
  trial_id_text text;
begin
  select * into bill_row
  from public.platform_bills
  where id = new.bill_id and school_id = new.school_id;

  if not found or bill_row.contract_id is null or bill_row.subscription_applied_at is not null then
    return new;
  end if;

  select coalesce(sum(pt.amount), 0)::numeric(12,2)
  into total_paid
  from public.platform_transactions pt
  where pt.bill_id = bill_row.id;

  if total_paid < bill_row.total_amount then
    return new;
  end if;

  update public.platform_bills
  set subscription_applied_at = timezone('utc', now())
  where id = bill_row.id
    and subscription_applied_at is null
  returning * into bill_row;

  if not found then
    return new;
  end if;

  select * into contract_row
  from public.platform_contracts
  where id = bill_row.contract_id and school_id = bill_row.school_id
  for update;

  if not found then
    raise exception 'The contract linked to this platform bill no longer exists';
  end if;

  if contract_row.status = 'cancelled' then
    return new;
  end if;

  period_start := greatest(
    coalesce(bill_row.billing_period_start, contract_row.start_date, new.transaction_date),
    new.transaction_date
  );
  period_end := coalesce(bill_row.billing_period_end, contract_row.subscription_valid_until, period_start);
  cycle_months := case contract_row.pricing_model when 'annual' then 12 when 'monthly' then 1 else 0 end;

  if cycle_months > 0 then
    period_end := greatest(
      period_end,
      (period_start + make_interval(months => cycle_months) - interval '1 day')::date
    );
    if contract_row.end_date is not null then
      period_end := least(period_end, contract_row.end_date);
    end if;
  else
    period_end := coalesce(bill_row.billing_period_end, contract_row.end_date, contract_row.renewal_date);
  end if;

  if period_end is null or period_end < period_start then
    raise exception 'The contract term has ended; create a new contract before recording this payment';
  end if;

  update public.platform_contracts
  set status = 'active',
      subscription_valid_until = period_end,
      end_date = case when contract_row.pricing_model = 'custom' then period_end else contract_row.end_date end,
      renewal_date = period_end,
      metadata = metadata || jsonb_build_object(
        'subscription_activated_at', timezone('utc', now()),
        'subscription_payment_bill', bill_row.bill_number
      )
  where id = contract_row.id;

  update public.schools set is_active = true where id = bill_row.school_id;

  trial_id_text := contract_row.metadata ->> 'trial_id';
  if trial_id_text ~* '^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$' then
    update public.school_trials
    set status = 'converted',
        notes = concat_ws(E'\n', nullif(notes, ''), 'Converted after the linked platform contract invoice was paid.')
    where id = trial_id_text::uuid
      and school_id = bill_row.school_id
      and status <> 'converted';
  end if;

  if cycle_months > 0 then
    next_period_start := period_end + 1;
    next_period_end := (next_period_start + make_interval(months => cycle_months) - interval '1 day')::date;
    if contract_row.end_date is not null then
      next_period_end := least(next_period_end, contract_row.end_date);
    end if;
    next_due_date := next_period_start - 7;
    invoice_amount := contract_row.monthly_amount * case when contract_row.pricing_model = 'annual' then 12 else 1 end;

    if contract_row.end_date is null or next_period_start <= contract_row.end_date then
      insert into public.platform_bills (
      school_id, contract_id, bill_number, description, total_amount,
      due_date, created_by, billing_period_start, billing_period_end
      )
      values (
      bill_row.school_id,
      contract_row.id,
      'PLT-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
      contract_row.plan_name || ' subscription (' || to_char(next_period_start, 'YYYY-MM-DD') || ' to ' || to_char(next_period_end, 'YYYY-MM-DD') || ')',
      invoice_amount,
      next_due_date,
      new.created_by,
      next_period_start,
      next_period_end
      )
      on conflict (contract_id, billing_period_start)
        where contract_id is not null and billing_period_start is not null
        do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists platform_transactions_apply_subscription on public.platform_transactions;
create trigger platform_transactions_apply_subscription
after insert or update of amount, bill_id, school_id on public.platform_transactions
for each row execute function public.apply_platform_subscription_payment();

revoke all on function public.school_subscription_access_active(uuid) from public, anon;
revoke all on function public.sync_user_school_lifecycle(uuid) from public, anon;
revoke all on function public.apply_platform_subscription_payment() from public, anon, authenticated;
grant execute on function public.school_subscription_access_active(uuid) to authenticated;
grant execute on function public.sync_user_school_lifecycle(uuid) to authenticated;
