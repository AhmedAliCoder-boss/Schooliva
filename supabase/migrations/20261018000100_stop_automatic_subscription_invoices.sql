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

  period_start := coalesce(bill_row.billing_period_start, contract_row.start_date, new.transaction_date);
  period_end := coalesce(bill_row.billing_period_end, contract_row.subscription_valid_until, period_start);

  if contract_row.pricing_model in ('monthly', 'annual') then
    period_end := greatest(
      period_end,
      (period_start + make_interval(months => case contract_row.pricing_model when 'annual' then 12 else 1 end) - interval '1 day')::date
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

  return new;
end;
$$;
