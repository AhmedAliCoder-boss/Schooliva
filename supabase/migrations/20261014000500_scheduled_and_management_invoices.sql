create table public.student_invoice_schedules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null,
  academic_session_id uuid not null,
  fee_structure_ids uuid[] not null check (cardinality(fee_structure_ids) > 0),
  frequency text not null check (frequency in ('monthly', 'quarterly', 'yearly')),
  anchor_date date not null,
  next_invoice_date date not null,
  period_index integer not null default 0 check (period_index >= 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, student_id) references public.students (school_id, id) on delete cascade,
  foreign key (school_id, academic_session_id) references public.academic_sessions (school_id, id) on delete restrict,
  unique (school_id, id),
  unique (school_id, student_id, academic_session_id)
);

create table public.student_invoice_schedule_runs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  schedule_id uuid not null,
  period_date date not null,
  invoice_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (schedule_id, period_date),
  unique (invoice_id)
);

alter table public.fee_invoices add constraint fee_invoices_school_id_id_key unique (school_id, id);
alter table public.student_invoice_schedule_runs
  add constraint student_invoice_schedule_runs_schedule_school_fk
  foreign key (school_id, schedule_id)
  references public.student_invoice_schedules (school_id, id) on delete restrict;
alter table public.student_invoice_schedule_runs
  add constraint student_invoice_schedule_runs_invoice_school_fk
  foreign key (school_id, invoice_id)
  references public.fee_invoices (school_id, id) on delete restrict;

create index student_invoice_schedules_due_idx
  on public.student_invoice_schedules (next_invoice_date)
  where is_active;

create or replace function public.student_invoice_schedule_date(
  target_anchor date,
  target_frequency text,
  target_period_index integer
)
returns date
language plpgsql
immutable
set search_path = public
as $$
declare
  target_month date;
  month_count integer;
begin
  if target_anchor is null or target_period_index < 0 then
    raise exception 'Invoice schedule date inputs are invalid.';
  end if;
  month_count := case target_frequency
    when 'monthly' then 1
    when 'quarterly' then 3
    when 'yearly' then 12
    else null
  end;
  if month_count is null then
    raise exception 'Invoice schedule frequency is invalid.';
  end if;
  target_month := (date_trunc('month', target_anchor::timestamp)
    + make_interval(months => month_count * target_period_index))::date;
  return target_month + least(
    extract(day from target_anchor)::integer,
    extract(day from (target_month + interval '1 month - 1 day'))::integer
  ) - 1;
end;
$$;

create or replace function public.generate_student_scheduled_invoices(target_school_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  schedule_row public.student_invoice_schedules%rowtype;
  invoice_id uuid;
  invoice_sequence integer;
  invoice_number text;
  generated_count integer := 0;
  items_count integer;
begin
  if auth.uid() is not null then
    if target_school_id is null
      or not public.has_permission(target_school_id, 'fees', 'manage') then
      raise exception 'You do not have permission to generate invoices for this school.';
    end if;
  end if;

  for schedule_row in
    select schedule.*
      from public.student_invoice_schedules schedule
      join public.students student
        on student.school_id = schedule.school_id
       and student.id = schedule.student_id
     where schedule.is_active
       and student.is_active
       and student.status = 'active'
       and schedule.next_invoice_date <= current_date
       and (target_school_id is null or schedule.school_id = target_school_id)
     order by schedule.next_invoice_date, schedule.school_id, schedule.id
     for update of schedule
  loop
    while schedule_row.next_invoice_date <= current_date loop
      insert into public.fee_invoice_number_sequences as sequences (school_id, last_value)
      values (schedule_row.school_id, 1)
      on conflict (school_id) do update
        set last_value = sequences.last_value + 1
        where sequences.last_value < 999999
      returning last_value into invoice_sequence;
      if not found then
        raise exception 'The invoice number sequence is full for school %.', schedule_row.school_id;
      end if;
      invoice_number := 'INV-' || lpad(invoice_sequence::text, 6, '0');

      insert into public.fee_invoices (
        school_id, academic_session_id, student_id, invoice_number, due_date, notes, created_by
      ) values (
        schedule_row.school_id,
        schedule_row.academic_session_id,
        schedule_row.student_id,
        invoice_number,
        schedule_row.next_invoice_date,
        'Automatically generated scheduled invoice.',
        schedule_row.created_by
      ) returning id into invoice_id;

      insert into public.fee_invoice_items (
        school_id, invoice_id, fee_structure_id, fee_type, description, amount, is_optional
      )
      select schedule_row.school_id,
             invoice_id,
             structure.id,
             structure.fee_type,
             structure.fee_type,
             structure.amount,
             structure.is_optional
        from public.fee_structures structure
       where structure.school_id = schedule_row.school_id
         and structure.academic_session_id = schedule_row.academic_session_id
         and structure.id = any(schedule_row.fee_structure_ids)
         and structure.is_active
         and structure.frequency <> 'one_time';
      get diagnostics items_count = row_count;
      if items_count <> cardinality(schedule_row.fee_structure_ids) then
        raise exception 'A scheduled fee item is inactive or no longer available for schedule %.', schedule_row.id;
      end if;

      insert into public.student_invoice_schedule_runs (school_id, schedule_id, period_date, invoice_id)
      values (schedule_row.school_id, schedule_row.id, schedule_row.next_invoice_date, invoice_id);

      schedule_row.period_index := schedule_row.period_index + 1;
      schedule_row.next_invoice_date := public.student_invoice_schedule_date(
        schedule_row.anchor_date,
        schedule_row.frequency,
        schedule_row.period_index
      );
      generated_count := generated_count + 1;
    end loop;

    update public.student_invoice_schedules
       set period_index = schedule_row.period_index,
           next_invoice_date = schedule_row.next_invoice_date,
           updated_at = timezone('utc', now())
     where id = schedule_row.id;
  end loop;
  return generated_count;
end;
$$;

alter table public.student_invoice_schedules enable row level security;
alter table public.student_invoice_schedule_runs enable row level security;

create policy "Authorized users can read student invoice schedules"
on public.student_invoice_schedules for select to authenticated
using (public.has_permission(school_id, 'fees', 'view') or public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin());
create policy "Authorized users can manage student invoice schedules"
on public.student_invoice_schedules for all to authenticated
using (public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin());
create policy "Authorized users can read student invoice schedule runs"
on public.student_invoice_schedule_runs for select to authenticated
using (public.has_permission(school_id, 'fees', 'view') or public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin());
create policy "Authorized users can manage student invoice schedule runs"
on public.student_invoice_schedule_runs for all to authenticated
using (public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin());

create trigger student_invoice_schedules_set_updated_at
before update on public.student_invoice_schedules
for each row execute function public.set_updated_at();

revoke all on function public.generate_student_scheduled_invoices(uuid) from public, anon;
grant execute on function public.generate_student_scheduled_invoices(uuid) to authenticated, service_role;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'generate-student-scheduled-invoices',
  '15 0 * * *',
  'select public.generate_student_scheduled_invoices();'
);

create table public.management_invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  invoice_number text not null,
  recipient_name text not null check (length(trim(recipient_name)) > 0),
  recipient_email text,
  recipient_phone text,
  due_date date not null,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  remaining_amount numeric(12,2) not null default 0 check (remaining_amount >= 0),
  status text not null default 'unpaid' check (status in ('unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  unique (school_id, invoice_number)
);

create table public.management_invoice_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  invoice_id uuid not null,
  description text not null check (length(trim(description)) > 0),
  quantity numeric(10,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, invoice_id) references public.management_invoices (school_id, id) on delete cascade
);

create trigger management_invoices_set_updated_at
before update on public.management_invoices
for each row execute function public.set_updated_at();

alter table public.management_invoices enable row level security;
alter table public.management_invoice_items enable row level security;

create policy "Authorized users can read management invoices"
on public.management_invoices for select to authenticated
using (public.has_permission(school_id, 'fees', 'view') or public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin());
create policy "Authorized users can manage management invoices"
on public.management_invoices for all to authenticated
using (public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin());
create policy "Authorized users can read management invoice items"
on public.management_invoice_items for select to authenticated
using (public.has_permission(school_id, 'fees', 'view') or public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin());
create policy "Authorized users can manage management invoice items"
on public.management_invoice_items for all to authenticated
using (public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'fees', 'manage') or public.is_super_admin());
