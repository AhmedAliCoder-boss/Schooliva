create table public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, name)
);

create table public.inventory_units (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  short_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, short_name),
  unique (school_id, name)
);

create table public.inventory_suppliers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, name)
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  category_id uuid not null references public.inventory_categories (id) on delete restrict,
  unit_id uuid not null references public.inventory_units (id) on delete restrict,
  supplier_id uuid references public.inventory_suppliers (id) on delete set null,
  sku text not null,
  name text not null,
  description text,
  cost numeric(12,2) not null default 0 check (cost >= 0),
  location text,
  min_stock_level integer not null default 0 check (min_stock_level >= 0),
  current_quantity integer not null default 0 check (current_quantity >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, sku),
  unique (school_id, name)
);

create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id) on delete restrict,
  transaction_type text not null check (transaction_type in ('stock_in', 'stock_out', 'adjustment', 'return')),
  quantity integer not null check (quantity <> 0),
  unit_cost numeric(12,2),
  reference text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create trigger inventory_categories_set_updated_at before update on public.inventory_categories for each row execute function public.set_updated_at();
create trigger inventory_units_set_updated_at before update on public.inventory_units for each row execute function public.set_updated_at();
create trigger inventory_suppliers_set_updated_at before update on public.inventory_suppliers for each row execute function public.set_updated_at();
create trigger inventory_items_set_updated_at before update on public.inventory_items for each row execute function public.set_updated_at();

create index inventory_items_school_status_idx on public.inventory_items (school_id, status, current_quantity, min_stock_level);
create index inventory_transactions_item_date_idx on public.inventory_transactions (school_id, item_id, created_at desc);

alter table public.inventory_categories enable row level security;
alter table public.inventory_units enable row level security;
alter table public.inventory_suppliers enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;

create or replace function public.update_inventory_quantity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.transaction_type = 'stock_in' then
    update public.inventory_items set current_quantity = current_quantity + new.quantity where id = new.item_id and school_id = new.school_id;
  elsif new.transaction_type in ('stock_out', 'adjustment') then
    update public.inventory_items set current_quantity = current_quantity - new.quantity where id = new.item_id and school_id = new.school_id;
  elsif new.transaction_type = 'return' then
    update public.inventory_items set current_quantity = current_quantity + abs(new.quantity) where id = new.item_id and school_id = new.school_id;
  end if;

  if not found then
    raise exception 'Inventory item not found';
  end if;

  return new;
end;
$$;

create trigger inventory_quantity_update
after insert on public.inventory_transactions
for each row
execute function public.update_inventory_quantity();

create policy "School members can read inventory metadata"
on public.inventory_categories for select to authenticated
using (public.has_permission(school_id, 'inventory', 'manage') or public.has_permission(school_id, 'reports', 'view') or public.is_super_admin());
create policy "Authorized inventory users can manage categories"
on public.inventory_categories for all to authenticated
using (public.has_permission(school_id, 'inventory', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'inventory', 'manage') or public.is_super_admin());

create policy "School members can read units"
on public.inventory_units for select to authenticated
using (public.has_permission(school_id, 'inventory', 'manage') or public.has_permission(school_id, 'reports', 'view') or public.is_super_admin());
create policy "Authorized inventory users can manage units"
on public.inventory_units for all to authenticated
using (public.has_permission(school_id, 'inventory', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'inventory', 'manage') or public.is_super_admin());

create policy "School members can read suppliers"
on public.inventory_suppliers for select to authenticated
using (public.has_permission(school_id, 'inventory', 'manage') or public.has_permission(school_id, 'reports', 'view') or public.is_super_admin());
create policy "Authorized inventory users can manage suppliers"
on public.inventory_suppliers for all to authenticated
using (public.has_permission(school_id, 'inventory', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'inventory', 'manage') or public.is_super_admin());

create policy "School members can read inventory items"
on public.inventory_items for select to authenticated
using (public.has_permission(school_id, 'inventory', 'manage') or public.has_permission(school_id, 'reports', 'view') or public.is_super_admin());
create policy "Authorized inventory users can manage inventory items"
on public.inventory_items for all to authenticated
using (public.has_permission(school_id, 'inventory', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'inventory', 'manage') or public.is_super_admin());

create policy "School members can read inventory transactions"
on public.inventory_transactions for select to authenticated
using (public.has_permission(school_id, 'inventory', 'manage') or public.has_permission(school_id, 'reports', 'view') or public.is_super_admin());
create policy "Authorized inventory users can manage inventory transactions"
on public.inventory_transactions for all to authenticated
using (public.has_permission(school_id, 'inventory', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'inventory', 'manage') or public.is_super_admin());
