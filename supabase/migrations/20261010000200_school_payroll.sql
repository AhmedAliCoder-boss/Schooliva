create table public.payroll_policies (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references public.schools (id) on delete cascade,
  working_days_per_month smallint not null default 26 check (working_days_per_month between 1 and 31),
  deduct_absences boolean not null default true,
  half_day_deduction_factor numeric(4,3) not null default 0.5 check (half_day_deduction_factor between 0 and 1),
  deduct_excused_days boolean not null default false,
  late_marks_per_day_deduction smallint not null default 0 check (late_marks_per_day_deduction between 0 and 31),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.payroll_compensations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  teacher_id uuid,
  staff_id uuid,
  monthly_salary numeric(12,2) not null check (monthly_salary > 0),
  is_active boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((teacher_id is not null) <> (staff_id is not null)),
  foreign key (school_id, teacher_id) references public.teachers (school_id, id) on delete cascade,
  foreign key (school_id, staff_id) references public.staff (school_id, id) on delete cascade,
  unique (school_id, id)
);

create unique index payroll_compensations_teacher_key
  on public.payroll_compensations (school_id, teacher_id) where teacher_id is not null;
create unique index payroll_compensations_staff_key
  on public.payroll_compensations (school_id, staff_id) where staff_id is not null;

create table public.payroll_compensation_components (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  compensation_id uuid not null,
  component_type text not null check (component_type in ('allowance', 'deduction')),
  name text not null check (length(trim(name)) between 2 and 80),
  amount numeric(12,2) not null check (amount > 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, compensation_id) references public.payroll_compensations (school_id, id) on delete cascade
);

create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  period_start date not null check (extract(day from period_start) = 1),
  status text not null default 'draft' check (status in ('draft', 'approved', 'paid')),
  working_days_per_month smallint not null check (working_days_per_month between 1 and 31),
  employee_count integer not null default 0,
  total_gross numeric(14,2) not null default 0,
  total_deductions numeric(14,2) not null default 0,
  total_net numeric(14,2) not null default 0,
  generated_by uuid references public.profiles (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (school_id, period_start),
  unique (school_id, id)
);

create table public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  payroll_run_id uuid not null,
  employee_type text not null check (employee_type in ('teacher', 'staff')),
  employee_id uuid not null,
  employee_code text not null,
  employee_name text not null,
  designation text not null,
  monthly_salary numeric(12,2) not null,
  attendance_snapshot jsonb not null default '{}'::jsonb,
  components_snapshot jsonb not null default '[]'::jsonb,
  absence_deduction_days numeric(8,3) not null default 0,
  attendance_deduction numeric(12,2) not null default 0,
  allowance_total numeric(12,2) not null default 0,
  fixed_deduction_total numeric(12,2) not null default 0,
  gross_amount numeric(12,2) not null,
  net_amount numeric(12,2) not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'not_payable')),
  paid_by uuid references public.profiles (id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, payroll_run_id) references public.payroll_runs (school_id, id) on delete cascade,
  unique (school_id, payroll_run_id, employee_type, employee_id),
  unique (school_id, id)
);

alter table public.school_expenses
  add column payroll_run_id uuid,
  add column payroll_item_id uuid;

alter table public.school_expenses
  add constraint school_expenses_payroll_run_fk
  foreign key (school_id, payroll_run_id) references public.payroll_runs (school_id, id) on delete restrict,
  add constraint school_expenses_payroll_item_fk
  foreign key (school_id, payroll_item_id) references public.payroll_items (school_id, id) on delete restrict,
  add constraint school_expenses_payroll_pair_check
  check ((payroll_run_id is null) = (payroll_item_id is null));

create unique index school_expenses_payroll_item_key
  on public.school_expenses (school_id, payroll_item_id) where payroll_item_id is not null;
create index payroll_runs_school_period_idx on public.payroll_runs (school_id, period_start desc);
create index payroll_items_run_idx on public.payroll_items (school_id, payroll_run_id, employee_name);
create index payroll_components_employee_idx on public.payroll_compensation_components (school_id, compensation_id, is_active);

create trigger payroll_policies_set_updated_at
before update on public.payroll_policies
for each row execute function public.set_updated_at();
create trigger payroll_compensations_set_updated_at
before update on public.payroll_compensations
for each row execute function public.set_updated_at();
create trigger payroll_components_set_updated_at
before update on public.payroll_compensation_components
for each row execute function public.set_updated_at();

alter table public.payroll_policies enable row level security;
alter table public.payroll_compensations enable row level security;
alter table public.payroll_compensation_components enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_items enable row level security;

insert into public.permissions (resource, action, description)
values
  ('payroll', 'view', 'View payroll policies, salaries, and payroll records'),
  ('payroll', 'manage', 'Configure compensation and manage payroll runs'),
  ('payroll_policy', 'manage', 'Configure attendance and salary deduction policy')
on conflict (resource, action) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.resource = 'payroll' and p.action in ('view', 'manage')
where r.school_id is null and r.slug in ('school_admin', 'principal', 'accountant', 'hr_manager', 'super_admin')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.resource = 'payroll_policy' and p.action = 'manage'
where r.school_id is null and r.slug in ('school_admin', 'principal', 'super_admin')
on conflict do nothing;

create policy "Payroll authorized users can read policies"
on public.payroll_policies for select to authenticated
using (public.has_permission(school_id, 'payroll', 'view') or public.is_super_admin());
create policy "Payroll managers can manage policies"
on public.payroll_policies for all to authenticated
using (public.has_permission(school_id, 'payroll_policy', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'payroll_policy', 'manage') or public.is_super_admin());

create policy "Payroll authorized users can read compensation"
on public.payroll_compensations for select to authenticated
using (public.has_permission(school_id, 'payroll', 'view') or public.is_super_admin());
create policy "Payroll managers can manage compensation"
on public.payroll_compensations for all to authenticated
using (public.has_permission(school_id, 'payroll', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'payroll', 'manage') or public.is_super_admin());

create policy "Payroll authorized users can read compensation components"
on public.payroll_compensation_components for select to authenticated
using (public.has_permission(school_id, 'payroll', 'view') or public.is_super_admin());
create policy "Payroll managers can manage compensation components"
on public.payroll_compensation_components for all to authenticated
using (public.has_permission(school_id, 'payroll', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'payroll', 'manage') or public.is_super_admin());

create policy "Payroll authorized users can read runs"
on public.payroll_runs for select to authenticated
using (public.has_permission(school_id, 'payroll', 'view') or public.is_super_admin());
create policy "Payroll managers can create runs"
on public.payroll_runs for insert to authenticated
with check (public.has_permission(school_id, 'payroll', 'manage') or public.is_super_admin());

create policy "Payroll authorized users can read items"
on public.payroll_items for select to authenticated
using (public.has_permission(school_id, 'payroll', 'view') or public.is_super_admin());

create policy "Payroll managers can view employee records"
on public.teachers for select to authenticated
using (public.has_permission(school_id, 'payroll', 'view'));
create policy "Payroll managers can view staff records"
on public.staff for select to authenticated
using (public.has_permission(school_id, 'payroll', 'view'));

create or replace function public.generate_school_payroll(target_school_id uuid, target_period_start date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_policy public.payroll_policies%rowtype;
  v_run_id uuid;
begin
  if v_actor is null or not public.has_permission(target_school_id, 'payroll', 'manage') then
    raise exception 'Not authorized to generate payroll';
  end if;
  if target_period_start is null or extract(day from target_period_start) <> 1 then
    raise exception 'Payroll period must start on the first day of a month';
  end if;
  select * into v_policy from public.payroll_policies where school_id = target_school_id;
  if not found then
    raise exception 'Configure the payroll policy before generating a payroll run';
  end if;

  insert into public.payroll_runs (school_id, period_start, working_days_per_month, generated_by)
  values (target_school_id, target_period_start, v_policy.working_days_per_month, v_actor)
  returning id into v_run_id;

  with active_compensation as (
    select c.id, c.school_id, c.teacher_id, c.staff_id, c.monthly_salary,
      case when c.teacher_id is not null then 'teacher' else 'staff' end as employee_type,
      coalesce(t.id, s.id) as employee_id,
      coalesce(t.employee_code, s.employee_code) as employee_code,
      concat_ws(' ', coalesce(t.first_name, s.first_name), coalesce(t.last_name, s.last_name)) as employee_name,
      coalesce(t.specialization, s.designation, 'Employee') as designation
    from public.payroll_compensations c
    left join public.teachers t on t.school_id = c.school_id and t.id = c.teacher_id
    left join public.staff s on s.school_id = c.school_id and s.id = c.staff_id
    where c.school_id = target_school_id and c.is_active
      and ((c.teacher_id is not null and t.is_active and t.deleted_at is null and t.employment_status = 'active')
        or (c.staff_id is not null and s.is_active and s.deleted_at is null and s.employment_status = 'active'))
  ),
  attendance as (
    select pa.teacher_id, pa.staff_id,
      count(*) filter (where pa.status = 'absent')::numeric as absent_days,
      count(*) filter (where pa.status = 'half_day')::numeric as half_days,
      count(*) filter (where pa.status = 'excused')::numeric as excused_days,
      count(*) filter (where pa.status = 'late')::numeric as late_days
    from public.people_attendance pa
    where pa.school_id = target_school_id
      and pa.attendance_date >= target_period_start
      and pa.attendance_date < (target_period_start + interval '1 month')
    group by pa.teacher_id, pa.staff_id
  ),
  components as (
    select pc.compensation_id,
      coalesce(jsonb_agg(jsonb_build_object('type', pc.component_type, 'name', pc.name, 'amount', pc.amount) order by pc.component_type, pc.name), '[]'::jsonb) as snapshot,
      coalesce(sum(pc.amount) filter (where pc.component_type = 'allowance'), 0)::numeric as allowance_total,
      coalesce(sum(pc.amount) filter (where pc.component_type = 'deduction'), 0)::numeric as fixed_deduction_total
    from public.payroll_compensation_components pc
    where pc.school_id = target_school_id and pc.is_active
    group by pc.compensation_id
  ),
  prepared as (
    select c.*,
      coalesce(a.absent_days, 0) as absent_days,
      coalesce(a.half_days, 0) as half_days,
      coalesce(a.excused_days, 0) as excused_days,
      coalesce(a.late_days, 0) as late_days,
      coalesce(cp.snapshot, '[]'::jsonb) as component_snapshot,
      coalesce(cp.allowance_total, 0)::numeric as allowance_total,
      coalesce(cp.fixed_deduction_total, 0)::numeric as fixed_deduction_total,
      least(v_policy.working_days_per_month::numeric,
        (case when v_policy.deduct_absences then coalesce(a.absent_days, 0) else 0 end)
        + coalesce(a.half_days, 0) * v_policy.half_day_deduction_factor
        + (case when v_policy.deduct_excused_days then coalesce(a.excused_days, 0) else 0 end)
        + (case when v_policy.late_marks_per_day_deduction > 0 then floor(coalesce(a.late_days, 0) / v_policy.late_marks_per_day_deduction::numeric) else 0 end)
      ) as deduction_days
    from active_compensation c
    left join attendance a on (c.employee_type = 'teacher' and a.teacher_id = c.employee_id)
      or (c.employee_type = 'staff' and a.staff_id = c.employee_id)
    left join components cp on cp.compensation_id = c.id
  ),
  inserted as (
    insert into public.payroll_items (
      school_id, payroll_run_id, employee_type, employee_id, employee_code, employee_name, designation,
      monthly_salary, attendance_snapshot, components_snapshot, absence_deduction_days,
      attendance_deduction, allowance_total, fixed_deduction_total, gross_amount, net_amount
    )
    select target_school_id, v_run_id, p.employee_type, p.employee_id, p.employee_code, p.employee_name, p.designation,
      p.monthly_salary,
      jsonb_build_object('absent', p.absent_days, 'half_day', p.half_days, 'excused', p.excused_days, 'late', p.late_days),
      p.component_snapshot,
      p.deduction_days,
      round(p.monthly_salary * p.deduction_days / v_policy.working_days_per_month, 2),
      p.allowance_total,
      p.fixed_deduction_total,
      p.monthly_salary + p.allowance_total,
      greatest(0, round(p.monthly_salary + p.allowance_total - p.fixed_deduction_total
        - p.monthly_salary * p.deduction_days / v_policy.working_days_per_month, 2))
    from prepared p
    returning gross_amount, fixed_deduction_total, attendance_deduction, net_amount
  )
  update public.payroll_runs r set
    employee_count = (select count(*) from inserted),
    total_gross = coalesce((select sum(gross_amount) from inserted), 0),
    total_deductions = coalesce((select sum(fixed_deduction_total + attendance_deduction) from inserted), 0),
    total_net = coalesce((select sum(net_amount) from inserted), 0)
  where r.id = v_run_id and r.school_id = target_school_id;

  update public.payroll_items
    set status = 'not_payable'
    where school_id = target_school_id and payroll_run_id = v_run_id and net_amount = 0;

  if not exists (select 1 from public.payroll_items where school_id = target_school_id and payroll_run_id = v_run_id) then
    raise exception 'No active employees have payroll profiles';
  end if;
  return v_run_id;
end;
$$;

create or replace function public.settle_school_payroll_item(
  target_school_id uuid,
  target_payroll_item_id uuid,
  target_payment_method public.payment_method,
  target_reference text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_item public.payroll_items%rowtype;
  v_run public.payroll_runs%rowtype;
begin
  if v_actor is null or not public.has_permission(target_school_id, 'payroll', 'manage') then
    raise exception 'Not authorized to settle payroll';
  end if;
  if target_reference is null or length(trim(target_reference)) < 2 or length(target_reference) > 80 then
    raise exception 'A valid payment reference is required';
  end if;
  select * into v_item from public.payroll_items
    where id = target_payroll_item_id and school_id = target_school_id for update;
  if not found or v_item.status <> 'pending' then
    raise exception 'Payroll item is unavailable or already paid';
  end if;
  select * into v_run from public.payroll_runs
    where id = v_item.payroll_run_id and school_id = target_school_id for update;
  if not found or v_run.status not in ('approved', 'paid') then
    raise exception 'Approve this payroll run before recording payments';
  end if;

  insert into public.school_expenses (
    school_id, category, description, vendor, amount, payment_method, expense_date,
    reference, notes, created_by, payroll_run_id, payroll_item_id
  ) values (
    target_school_id, 'salary', 'Salary - ' || v_item.employee_name, v_item.employee_name,
    v_item.net_amount, target_payment_method, current_date, trim(target_reference),
    'Payroll for ' || to_char(v_run.period_start, 'FMMonth YYYY') || ' (' || v_item.employee_code || ')',
    v_actor, v_run.id, v_item.id
  );
  update public.payroll_items set status = 'paid', paid_by = v_actor, paid_at = timezone('utc', now())
    where id = v_item.id and school_id = target_school_id;
  update public.payroll_runs set status = case
      when not exists (select 1 from public.payroll_items where school_id = target_school_id and payroll_run_id = v_run.id and status = 'pending') then 'paid'
      else 'approved'
    end,
    completed_at = case
      when not exists (select 1 from public.payroll_items where school_id = target_school_id and payroll_run_id = v_run.id and status = 'pending') then timezone('utc', now())
      else null
    end
  where id = v_run.id and school_id = target_school_id;
end;
$$;

create or replace function public.approve_school_payroll(target_school_id uuid, target_payroll_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null or not public.has_permission(target_school_id, 'payroll', 'manage') then
    raise exception 'Not authorized to approve payroll';
  end if;
  update public.payroll_runs
    set status = case when exists (
        select 1 from public.payroll_items where school_id = target_school_id and payroll_run_id = target_payroll_run_id and status = 'pending'
      ) then 'approved' else 'paid' end,
      approved_by = v_actor,
      approved_at = timezone('utc', now()),
      completed_at = case when exists (
        select 1 from public.payroll_items where school_id = target_school_id and payroll_run_id = target_payroll_run_id and status = 'pending'
      ) then null else timezone('utc', now()) end
    where id = target_payroll_run_id and school_id = target_school_id and status = 'draft';
  if not found then
    raise exception 'Payroll run is unavailable or already approved';
  end if;
end;
$$;

grant execute on function public.generate_school_payroll(uuid, date) to authenticated;
grant execute on function public.settle_school_payroll_item(uuid, uuid, public.payment_method, text) to authenticated;
grant execute on function public.approve_school_payroll(uuid, uuid) to authenticated;
