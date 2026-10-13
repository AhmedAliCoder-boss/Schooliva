alter table public.payroll_runs
  add column deduct_absences boolean,
  add column half_day_deduction_factor numeric(4,3) check (half_day_deduction_factor between 0 and 1),
  add column deduct_excused_days boolean,
  add column late_marks_per_day_deduction smallint check (late_marks_per_day_deduction between 0 and 31);

create or replace function public.snapshot_school_payroll_policy()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_policy public.payroll_policies%rowtype;
begin
  select * into v_policy
  from public.payroll_policies
  where school_id = new.school_id;

  if not found then
    raise exception 'Configure the payroll policy before generating a payroll run';
  end if;

  new.working_days_per_month := v_policy.working_days_per_month;
  new.deduct_absences := v_policy.deduct_absences;
  new.half_day_deduction_factor := v_policy.half_day_deduction_factor;
  new.deduct_excused_days := v_policy.deduct_excused_days;
  new.late_marks_per_day_deduction := v_policy.late_marks_per_day_deduction;
  return new;
end;
$$;

create trigger payroll_runs_snapshot_policy
before insert on public.payroll_runs
for each row execute function public.snapshot_school_payroll_policy();
