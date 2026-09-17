-- Phase 27: integrity protections discovered by the test strategy.

create unique index if not exists fee_payments_school_reference_key
  on public.fee_payments (school_id, payment_reference);

create or replace function public.validate_payment_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_total numeric(12,2);
  existing_paid numeric(12,2);
begin
  select total into invoice_total
  from public.fee_invoices
  where id = new.invoice_id and school_id = new.school_id
  for update;

  if invoice_total is null then
    raise exception 'Invoice does not belong to this school';
  end if;

  select coalesce(sum(amount), 0) into existing_paid
  from public.fee_payments
  where invoice_id = new.invoice_id
    and (tg_op = 'INSERT' or id <> new.id);

  if existing_paid + new.amount > invoice_total then
    raise exception 'Payment exceeds invoice balance';
  end if;

  return new;
end;
$$;

drop trigger if exists fee_payments_validate_amount on public.fee_payments;
create trigger fee_payments_validate_amount
before insert or update of invoice_id, amount on public.fee_payments
for each row execute function public.validate_payment_amount();

create or replace function public.ensure_copy_available()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  copy_status text;
begin
  select status into copy_status
  from public.library_book_copies
  where id = new.copy_id and school_id = new.school_id
  for update;

  if copy_status is null then
    raise exception 'Library copy does not belong to this school';
  end if;

  if copy_status <> 'available' then
    raise exception 'This copy is not available to issue';
  end if;

  if exists (
    select 1 from public.library_transactions t
    where t.copy_id = new.copy_id and t.status = 'issued'
  ) then
    raise exception 'Another active issue exists for this copy';
  end if;

  update public.library_book_copies
  set status = 'issued'
  where id = new.copy_id and school_id = new.school_id;
  return new;
end;
$$;

create or replace function public.validate_inventory_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_quantity integer;
begin
  if new.quantity <= 0 and new.transaction_type in ('stock_in', 'stock_out', 'return') then
    raise exception 'Stock movement quantity must be positive';
  end if;

  if new.transaction_type = 'stock_out' then
    select current_quantity into current_quantity
    from public.inventory_items
    where id = new.item_id and school_id = new.school_id
    for update;

    if current_quantity is null then
      raise exception 'Inventory item does not belong to this school';
    end if;
    if current_quantity < new.quantity then
      raise exception 'Stock out exceeds available quantity';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_transaction_validate on public.inventory_transactions;
create trigger inventory_transaction_validate
before insert on public.inventory_transactions
for each row execute function public.validate_inventory_transaction();
