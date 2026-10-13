create table public.fee_invoice_number_sequences (
  school_id uuid primary key references public.schools (id) on delete cascade,
  last_value integer not null check (last_value between 1 and 999999)
);

alter table public.fee_invoice_number_sequences enable row level security;

insert into public.fee_invoice_number_sequences (school_id, last_value)
select school_id, max(coalesce(
    substring(invoice_number from '^INV-([0-9]{6})$')::integer,
    substring(invoice_number from '^INV-[0-9]{4}-([0-9]+)$')::integer
  ))
  from public.fee_invoices
 where invoice_number ~ '^INV-[0-9]{6}$'
    or invoice_number ~ '^INV-[0-9]{4}-[0-9]+$'
 group by school_id
on conflict (school_id) do update
  set last_value = greatest(
    public.fee_invoice_number_sequences.last_value,
    excluded.last_value
  );

create or replace function public.next_fee_invoice_number(target_school_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value integer;
begin
  if auth.uid() is null
    or not public.has_permission(target_school_id, 'fees', 'manage') then
    raise exception 'You do not have permission to create invoices for this school.';
  end if;

  insert into public.fee_invoice_number_sequences as sequences (school_id, last_value)
  values (target_school_id, 1)
  on conflict (school_id) do update
    set last_value = sequences.last_value + 1
    where sequences.last_value < 999999
  returning last_value into next_value;

  if not found then
    raise exception 'The invoice number sequence is full for this school.';
  end if;

  return next_value;
end;
$$;

revoke all on table public.fee_invoice_number_sequences from public, anon, authenticated;
revoke all on function public.next_fee_invoice_number(uuid) from public, anon;
grant execute on function public.next_fee_invoice_number(uuid) to authenticated;
