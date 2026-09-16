create type public.fee_frequency as enum ('one_time', 'monthly', 'term', 'quarterly', 'yearly');
create type public.fee_status as enum ('unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled');
create type public.payment_method as enum ('cash', 'bank_transfer', 'card', 'upi', 'cheque', 'other');

create table public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_session_id uuid not null,
  class_id uuid not null,
  fee_type text not null,
  amount numeric(12,2) not null check (amount >= 0),
  frequency public.fee_frequency not null,
  due_day smallint not null check (due_day between 1 and 31),
  is_optional boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, academic_session_id) references public.academic_sessions (school_id, id) on delete restrict,
  foreign key (school_id, class_id) references public.classes (school_id, id) on delete restrict,
  unique (school_id, academic_session_id, class_id, fee_type)
);

create table public.fee_invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_session_id uuid not null,
  student_id uuid not null,
  invoice_number text not null,
  due_date date not null,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0 check (discount >= 0),
  late_fee numeric(12,2) not null default 0 check (late_fee >= 0),
  total numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  remaining_amount numeric(12,2) not null default 0,
  status public.fee_status not null default 'unpaid',
  notes text,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, academic_session_id) references public.academic_sessions (school_id, id) on delete restrict,
  foreign key (school_id, student_id) references public.students (school_id, id) on delete restrict,
  unique (school_id, invoice_number)
);

create table public.fee_invoice_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  invoice_id uuid not null references public.fee_invoices (id) on delete restrict,
  fee_structure_id uuid references public.fee_structures (id) on delete restrict,
  fee_type text not null,
  description text,
  amount numeric(12,2) not null check (amount >= 0),
  is_optional boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  invoice_id uuid not null references public.fee_invoices (id) on delete restrict,
  payment_reference text not null,
  amount numeric(12,2) not null check (amount > 0),
  payment_method public.payment_method not null,
  payment_date date not null,
  received_by uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.finance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.recalculate_invoice_from_finance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_subtotal numeric(12,2);
  v_discount numeric(12,2);
  v_late_fee numeric(12,2);
  v_paid numeric(12,2);
  v_total numeric(12,2);
  v_remaining numeric(12,2);
  v_status public.fee_status;
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);

  select coalesce(sum(amount), 0), coalesce((select discount from public.fee_invoices where id = v_invoice_id), 0), coalesce((select late_fee from public.fee_invoices where id = v_invoice_id), 0)
    into v_subtotal, v_discount, v_late_fee
  from public.fee_invoice_items where invoice_id = v_invoice_id;

  select coalesce(sum(amount), 0) into v_paid
  from public.fee_payments where invoice_id = v_invoice_id;

  v_total := v_subtotal - v_discount + v_late_fee;
  v_remaining := v_total - v_paid;

  if v_remaining <= 0 then
    v_status := 'paid';
  elsif v_paid > 0 then
    v_status := 'partially_paid';
  elsif current_date > (select due_date from public.fee_invoices where id = v_invoice_id) then
    v_status := 'overdue';
  else
    v_status := 'unpaid';
  end if;

  update public.fee_invoices
  set subtotal = v_subtotal,
      total = v_total,
      paid_amount = v_paid,
      remaining_amount = v_remaining,
      status = v_status,
      updated_at = timezone('utc', now())
  where id = v_invoice_id;

  return coalesce(new, old);
end;
$$;

create or replace function public.log_finance_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.finance_audit_logs (school_id, entity_type, entity_id, action, actor_id, payload)
  values (
    coalesce(new.school_id, old.school_id),
    tg_table_name,
    coalesce(new.id, old.id),
    lower(tg_op),
    coalesce(new.created_by, new.received_by, old.created_by, old.received_by),
    to_jsonb(coalesce(new, old))
  );
  return coalesce(new, old);
end;
$$;

create trigger fee_invoices_recalc_after_item_change
after insert or update of amount or delete on public.fee_invoice_items
for each row
execute function public.recalculate_invoice_from_finance();

create trigger fee_invoices_recalc_after_payment_change
after insert or update of amount or delete on public.fee_payments
for each row
execute function public.recalculate_invoice_from_finance();

create trigger fee_invoices_audit
after insert or update or delete on public.fee_invoices
for each row execute function public.log_finance_event();

create trigger fee_payments_audit
after insert or update or delete on public.fee_payments
for each row execute function public.log_finance_event();

create trigger fee_invoice_items_audit
after insert or update or delete on public.fee_invoice_items
for each row execute function public.log_finance_event();

create trigger fee_structures_set_updated_at
before update on public.fee_structures
for each row execute function public.set_updated_at();

create trigger fee_invoices_set_updated_at
before update on public.fee_invoices
for each row execute function public.set_updated_at();

create index fee_structures_school_session_idx on public.fee_structures (school_id, academic_session_id, class_id, fee_type);
create index fee_invoices_student_due_idx on public.fee_invoices (school_id, student_id, due_date, status);
create index fee_payments_invoice_date_idx on public.fee_payments (school_id, invoice_id, payment_date);
create index finance_audit_school_entity_idx on public.finance_audit_logs (school_id, entity_type, entity_id, created_at desc);

alter table public.fee_structures enable row level security;
alter table public.fee_invoices enable row level security;
alter table public.fee_invoice_items enable row level security;
alter table public.fee_payments enable row level security;
alter table public.finance_audit_logs enable row level security;

insert into public.permissions (resource, action, description)
values
  ('fees', 'view', 'View fee structure and invoice data'),
  ('fees', 'manage', 'Manage fee structures and invoices'),
  ('finance', 'view', 'View finance dashboards and reports'),
  ('finance', 'manage', 'Manage finance data and payment operations')
on conflict (resource, action) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.resource in ('fees', 'finance', 'reports')
where r.school_id is null and r.slug in ('super_admin', 'school_admin', 'principal', 'accountant')
  and (
    (r.slug in ('super_admin', 'school_admin') and p.resource in ('fees', 'finance', 'reports'))
    or (r.slug = 'principal' and p.resource in ('fees', 'finance', 'reports'))
    or (r.slug = 'accountant' and p.resource in ('fees', 'finance'))
  )
on conflict do nothing;

create policy "School members can read fee structures"
on public.fee_structures for select to authenticated
using (public.has_permission(school_id, 'fees', 'view') or public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin());

create policy "Authorized users can manage fee structures"
on public.fee_structures for all to authenticated
using (public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin());

create policy "School members can read invoices"
on public.fee_invoices for select to authenticated
using (
  public.has_permission(school_id, 'fees', 'view')
  or public.has_permission(school_id, 'fees', 'manage')
  or public.is_super_admin()
  or public.is_parent_of_student(student_id)
  or public.is_student_record(student_id)
);

create policy "Authorized users can manage invoices"
on public.fee_invoices for all to authenticated
using (public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin());

create policy "School members can read invoice items"
on public.fee_invoice_items for select to authenticated
using (public.has_permission(school_id, 'fees', 'view') or public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin());

create policy "Authorized users can manage invoice items"
on public.fee_invoice_items for all to authenticated
using (public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin());

create policy "Authorized users can read payments"
on public.fee_payments for select to authenticated
using (public.has_permission(school_id, 'fees', 'view') or public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin());

create policy "Authorized users can manage payments"
on public.fee_payments for all to authenticated
using (public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin());

create policy "Principal and admin can read audit logs"
on public.finance_audit_logs for select to authenticated
using (public.has_permission(school_id, 'fees', 'manage') or public.has_permission(school_id, 'reports', 'view') or public.is_super_admin());

create policy "Accountants can write audit logs only via server transactions"
on public.finance_audit_logs for insert to authenticated
with check (public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin());
