create table public.platform_bills (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  bill_number text not null,
  description text not null,
  total_amount numeric(12,2) not null check (total_amount > 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  due_date date not null,
  status text not null default 'unpaid' check (status in ('unpaid', 'partially_paid', 'paid', 'overdue')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, bill_number),
  unique (school_id, id)
);

create table public.platform_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  bill_id uuid not null,
  transaction_reference text not null,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'bank_transfer', 'card', 'upi', 'cheque', 'other')),
  transaction_date date not null,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (school_id, transaction_reference),
  foreign key (school_id, bill_id) references public.platform_bills (school_id, id) on delete restrict
);

create index platform_bills_school_due_idx on public.platform_bills (school_id, due_date desc);
create index platform_transactions_school_date_idx on public.platform_transactions (school_id, transaction_date desc);
create index platform_transactions_bill_idx on public.platform_transactions (bill_id, transaction_date desc);

alter table public.platform_bills enable row level security;
alter table public.platform_transactions enable row level security;

create policy "Master admins manage platform bills"
on public.platform_bills for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "Master admins manage platform transactions"
on public.platform_transactions for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create trigger platform_bills_set_updated_at
before update on public.platform_bills
for each row execute function public.set_updated_at();

create function public.validate_platform_transaction_amount()
returns trigger
language plpgsql
as $$
declare
  bill_total numeric(12,2);
  already_paid numeric(12,2);
begin
  select total_amount into bill_total
  from public.platform_bills
  where id = new.bill_id and school_id = new.school_id
  for update;

  if bill_total is null then
    raise exception 'Platform bill not found for this school';
  end if;

  select coalesce(sum(amount), 0) into already_paid
  from public.platform_transactions
  where bill_id = new.bill_id and id is distinct from new.id;

  if already_paid + new.amount > bill_total then
    raise exception 'Platform transaction exceeds the bill balance';
  end if;

  return new;
end;
$$;

create trigger platform_transactions_validate_amount
before insert or update of school_id, bill_id, amount on public.platform_transactions
for each row execute function public.validate_platform_transaction_amount();

create function public.recalculate_platform_bill_payment()
returns trigger
language plpgsql
as $$
declare
  affected_bill_id uuid;
begin
  if tg_op = 'DELETE' then
    affected_bill_id := old.bill_id;
  else
    affected_bill_id := new.bill_id;
  end if;

  update public.platform_bills b
  set paid_amount = totals.paid_amount,
      status = case
        when totals.paid_amount >= b.total_amount then 'paid'
        when totals.paid_amount > 0 then 'partially_paid'
        when b.due_date < current_date then 'overdue'
        else 'unpaid'
      end
  from (
    select coalesce(sum(amount), 0)::numeric(12,2) as paid_amount
    from public.platform_transactions
    where bill_id = affected_bill_id
  ) totals
  where b.id = affected_bill_id;

  if tg_op = 'UPDATE' and old.bill_id is distinct from new.bill_id then
    update public.platform_bills b
    set paid_amount = totals.paid_amount,
        status = case
          when totals.paid_amount >= b.total_amount then 'paid'
          when totals.paid_amount > 0 then 'partially_paid'
          when b.due_date < current_date then 'overdue'
          else 'unpaid'
        end
    from (
      select coalesce(sum(amount), 0)::numeric(12,2) as paid_amount
      from public.platform_transactions
      where bill_id = old.bill_id
    ) totals
    where b.id = old.bill_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger platform_transactions_recalculate_bill
after insert or update or delete on public.platform_transactions
for each row execute function public.recalculate_platform_bill_payment();