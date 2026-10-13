create table public.school_expenses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  category text not null check (category in ('salary', 'utilities', 'supplies', 'maintenance', 'transport', 'other')),
  description text not null check (length(trim(description)) between 2 and 160),
  vendor text check (vendor is null or length(vendor) <= 120),
  amount numeric(12,2) not null check (amount > 0),
  payment_method public.payment_method not null,
  expense_date date not null,
  reference text check (reference is null or length(reference) <= 80),
  notes text check (notes is null or length(notes) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index school_expenses_school_date_idx
  on public.school_expenses (school_id, expense_date desc);

create index school_expenses_school_category_idx
  on public.school_expenses (school_id, category, expense_date desc);

create trigger school_expenses_set_updated_at
before update on public.school_expenses
for each row execute function public.set_updated_at();

alter table public.school_expenses enable row level security;

create policy "Authorized users can read school expenses"
on public.school_expenses for select to authenticated
using (
  public.has_permission(school_id, 'finance', 'view')
  or public.has_permission(school_id, 'finance', 'manage')
  or public.is_super_admin()
);

create policy "Authorized users can manage school expenses"
on public.school_expenses for all to authenticated
using (
  public.has_permission(school_id, 'finance', 'manage')
  or public.is_super_admin()
)
with check (
  public.has_permission(school_id, 'finance', 'manage')
  or public.is_super_admin()
);
