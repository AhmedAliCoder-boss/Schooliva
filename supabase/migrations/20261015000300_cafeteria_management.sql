insert into public.permissions (resource, action, description)
values
  ('cafeteria', 'view', 'View Food & Cafeteria operations'),
  ('cafeteria', 'manage', 'Manage Food & Cafeteria operations')
on conflict (resource, action) do update set description = excluded.description;

insert into public.roles (school_id, name, slug, description, is_system)
values (null, 'Cafeteria Manager', 'cafeteria_manager', 'Manage cafeteria menus, stock, orders, and payments', true)
on conflict (slug) where school_id is null do update
set name = excluded.name, description = excluded.description, is_system = true;

insert into public.role_permissions (role_id, permission_id)
select role_row.id, permission_row.id
from public.roles role_row
join public.permissions permission_row
  on permission_row.resource = 'cafeteria'
 and permission_row.action in ('view', 'manage')
where role_row.school_id is null
  and role_row.slug in ('super_admin', 'school_admin', 'cafeteria_manager')
on conflict do nothing;

create table public.cafeteria_menu_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  category text not null check (category in ('breakfast', 'lunch', 'snack', 'beverage', 'other')),
  description text,
  price numeric(12,2) not null check (price >= 0),
  allergens text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  unique (school_id, name)
);

create table public.cafeteria_daily_menus (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  menu_item_id uuid not null,
  service_date date not null,
  meal_period text not null check (meal_period in ('breakfast', 'lunch', 'snack')),
  quantity_limit integer check (quantity_limit is null or quantity_limit > 0),
  is_available boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, menu_item_id) references public.cafeteria_menu_items (school_id, id) on delete restrict,
  unique (school_id, id),
  unique (school_id, menu_item_id, service_date, meal_period)
);

create table public.cafeteria_stock_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  sku text,
  unit text not null check (length(trim(unit)) between 1 and 24),
  cost_per_unit numeric(12,3) not null default 0 check (cost_per_unit >= 0),
  current_quantity numeric(12,3) not null default 0 check (current_quantity >= 0),
  reorder_level numeric(12,3) not null default 0 check (reorder_level >= 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  unique (school_id, name)
);

create unique index cafeteria_stock_items_school_sku_key
  on public.cafeteria_stock_items (school_id, sku)
  where sku is not null and sku <> '';

create table public.cafeteria_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  menu_item_id uuid not null,
  stock_item_id uuid not null,
  quantity_per_portion numeric(12,3) not null check (quantity_per_portion > 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, menu_item_id) references public.cafeteria_menu_items (school_id, id) on delete cascade,
  foreign key (school_id, stock_item_id) references public.cafeteria_stock_items (school_id, id) on delete restrict,
  unique (school_id, id),
  unique (school_id, menu_item_id, stock_item_id)
);

create table public.cafeteria_stock_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  stock_item_id uuid not null,
  transaction_type text not null check (transaction_type in ('stock_in', 'stock_out', 'waste', 'adjustment_add', 'adjustment_remove')),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_cost numeric(12,3) check (unit_cost is null or unit_cost >= 0),
  reference text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, stock_item_id) references public.cafeteria_stock_items (school_id, id) on delete restrict
);

create table public.cafeteria_order_sequences (
  school_id uuid not null references public.schools (id) on delete cascade,
  order_date date not null,
  last_value integer not null check (last_value > 0),
  primary key (school_id, order_date)
);

create table public.cafeteria_orders (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  order_number text not null,
  order_date date not null,
  customer_label text,
  status text not null default 'preparing' check (status in ('preparing', 'ready', 'served')),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  unique (school_id, order_number)
);

create table public.cafeteria_order_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  order_id uuid not null,
  menu_item_id uuid not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  foreign key (school_id, order_id) references public.cafeteria_orders (school_id, id) on delete restrict,
  foreign key (school_id, menu_item_id) references public.cafeteria_menu_items (school_id, id) on delete restrict,
  unique (school_id, id)
);

create table public.cafeteria_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  order_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'card', 'transfer', 'other')),
  payment_reference text,
  received_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, order_id) references public.cafeteria_orders (school_id, id) on delete restrict
);

create index cafeteria_daily_menus_date_idx on public.cafeteria_daily_menus (school_id, service_date, meal_period);
create index cafeteria_stock_items_reorder_idx on public.cafeteria_stock_items (school_id, is_active, current_quantity, reorder_level);
create index cafeteria_recipe_stock_idx on public.cafeteria_recipe_ingredients (school_id, stock_item_id);
create index cafeteria_stock_transactions_date_idx on public.cafeteria_stock_transactions (school_id, created_at desc);
create index cafeteria_orders_date_idx on public.cafeteria_orders (school_id, order_date desc, created_at desc);
create index cafeteria_order_items_item_idx on public.cafeteria_order_items (school_id, menu_item_id, order_id);
create index cafeteria_payments_order_idx on public.cafeteria_payments (school_id, order_id, created_at desc);

create trigger cafeteria_menu_items_set_updated_at before update on public.cafeteria_menu_items for each row execute function public.set_updated_at();
create trigger cafeteria_daily_menus_set_updated_at before update on public.cafeteria_daily_menus for each row execute function public.set_updated_at();
create trigger cafeteria_stock_items_set_updated_at before update on public.cafeteria_stock_items for each row execute function public.set_updated_at();
create trigger cafeteria_recipe_ingredients_set_updated_at before update on public.cafeteria_recipe_ingredients for each row execute function public.set_updated_at();
create trigger cafeteria_orders_set_updated_at before update on public.cafeteria_orders for each row execute function public.set_updated_at();

create or replace function public.update_cafeteria_stock_quantity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quantity_delta numeric(12,3);
begin
  quantity_delta := case
    when new.transaction_type in ('stock_in', 'adjustment_add') then new.quantity
    else -new.quantity
  end;

  update public.cafeteria_stock_items
     set current_quantity = current_quantity + quantity_delta,
         cost_per_unit = case
           when new.transaction_type = 'stock_in' and new.unit_cost is not null
             then (current_quantity * cost_per_unit + new.quantity * new.unit_cost)
               / nullif(current_quantity + new.quantity, 0)
           else cost_per_unit
         end
   where id = new.stock_item_id
     and school_id = new.school_id
     and current_quantity + quantity_delta >= 0;
  if not found then
    raise exception 'Cafeteria stock item was not found or does not have enough quantity.';
  end if;
  return new;
end;
$$;

create trigger cafeteria_stock_quantity_update
after insert on public.cafeteria_stock_transactions
for each row execute function public.update_cafeteria_stock_quantity();

create or replace function public.guard_cafeteria_stock_quantity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.current_quantity is distinct from old.current_quantity and pg_trigger_depth() < 2 then
    raise exception 'Cafeteria stock quantities must be changed through stock transactions.';
  end if;
  return new;
end;
$$;

create trigger cafeteria_stock_quantity_ledger_guard
before update of current_quantity on public.cafeteria_stock_items
for each row execute function public.guard_cafeteria_stock_quantity();

alter table public.cafeteria_menu_items enable row level security;
alter table public.cafeteria_daily_menus enable row level security;
alter table public.cafeteria_stock_items enable row level security;
alter table public.cafeteria_recipe_ingredients enable row level security;
alter table public.cafeteria_stock_transactions enable row level security;
alter table public.cafeteria_orders enable row level security;
alter table public.cafeteria_order_items enable row level security;
alter table public.cafeteria_payments enable row level security;
alter table public.cafeteria_order_sequences enable row level security;

create policy "Cafeteria managers can read menu items"
on public.cafeteria_menu_items for select to authenticated
using (public.has_permission(school_id, 'cafeteria', 'view') or public.is_super_admin());
create policy "Cafeteria managers can manage menu items"
on public.cafeteria_menu_items for all to authenticated
using (public.has_permission(school_id, 'cafeteria', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'cafeteria', 'manage') or public.is_super_admin());

create policy "Cafeteria managers can read daily menus"
on public.cafeteria_daily_menus for select to authenticated
using (public.has_permission(school_id, 'cafeteria', 'view') or public.is_super_admin());
create policy "Cafeteria managers can manage daily menus"
on public.cafeteria_daily_menus for all to authenticated
using (public.has_permission(school_id, 'cafeteria', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'cafeteria', 'manage') or public.is_super_admin());

create policy "Cafeteria managers can read stock items"
on public.cafeteria_stock_items for select to authenticated
using (public.has_permission(school_id, 'cafeteria', 'view') or public.is_super_admin());
create policy "Cafeteria managers can manage stock items"
on public.cafeteria_stock_items for all to authenticated
using (public.has_permission(school_id, 'cafeteria', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'cafeteria', 'manage') or public.is_super_admin());

create policy "Cafeteria managers can read recipes"
on public.cafeteria_recipe_ingredients for select to authenticated
using (public.has_permission(school_id, 'cafeteria', 'view') or public.is_super_admin());
create policy "Cafeteria managers can manage recipes"
on public.cafeteria_recipe_ingredients for all to authenticated
using (public.has_permission(school_id, 'cafeteria', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'cafeteria', 'manage') or public.is_super_admin());

create policy "Cafeteria managers can read stock transactions"
on public.cafeteria_stock_transactions for select to authenticated
using (public.has_permission(school_id, 'cafeteria', 'view') or public.is_super_admin());
create policy "Cafeteria managers can record stock transactions"
on public.cafeteria_stock_transactions for insert to authenticated
with check (public.has_permission(school_id, 'cafeteria', 'manage') or public.is_super_admin());

create policy "Cafeteria managers can read orders"
on public.cafeteria_orders for select to authenticated
using (public.has_permission(school_id, 'cafeteria', 'view') or public.is_super_admin());
create policy "Cafeteria managers can read order items"
on public.cafeteria_order_items for select to authenticated
using (public.has_permission(school_id, 'cafeteria', 'view') or public.is_super_admin());
create policy "Cafeteria managers can read payments"
on public.cafeteria_payments for select to authenticated
using (public.has_permission(school_id, 'cafeteria', 'view') or public.is_super_admin());

create or replace function public.create_cafeteria_order(
  target_school_id uuid,
  target_customer_label text,
  target_order_lines jsonb,
  target_initial_payment numeric default 0,
  target_payment_method text default 'cash',
  target_payment_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_local_date date := (timezone('Asia/Karachi', now()))::date;
  line_record record;
  ingredient_record record;
  v_menu_item_id uuid;
  v_item_quantity integer;
  v_menu_price numeric(12,2);
  v_menu_quantity_limit integer;
  v_sold_quantity bigint;
  order_total numeric(12,2) := 0;
  order_id uuid;
  order_sequence integer;
  generated_order_number text;
  payment_total numeric(12,2);
  line_count integer;
begin
  if auth.uid() is null or not public.has_permission(target_school_id, 'cafeteria', 'manage') then
    raise exception 'Not authorized to create cafeteria orders.';
  end if;
  if target_order_lines is null
     or jsonb_typeof(target_order_lines) <> 'array'
     or jsonb_array_length(target_order_lines) < 1
     or jsonb_array_length(target_order_lines) > 30
     or target_customer_label is null
     or length(trim(target_customer_label)) > 120
     or target_initial_payment is null
     or target_initial_payment < 0
     or target_initial_payment > 10000000
     or target_payment_method is null
     or target_payment_method not in ('cash', 'card', 'transfer', 'other')
     or length(coalesce(target_payment_reference, '')) > 100 then
    raise exception 'Cafeteria order details are invalid.';
  end if;

  select count(*), count(distinct value ->> 'menuItemId')
    into line_count, v_sold_quantity
    from jsonb_array_elements(target_order_lines);
  if line_count <> v_sold_quantity then
    raise exception 'Each cafeteria item must appear only once in an order.';
  end if;

  for line_record in
    select value as line
      from jsonb_array_elements(target_order_lines)
     order by value ->> 'menuItemId'
  loop
    if coalesce(line_record.line ->> 'quantity', '') !~ '^[1-9][0-9]{0,2}$' then
      raise exception 'Cafeteria item quantities must be between 1 and 100.';
    end if;
    begin
      v_menu_item_id := (line_record.line ->> 'menuItemId')::uuid;
      v_item_quantity := (line_record.line ->> 'quantity')::integer;
    exception when others then
      raise exception 'Cafeteria order item details are invalid.';
    end;

    select menu_item.price, daily_menu.quantity_limit
      into v_menu_price, v_menu_quantity_limit
      from public.cafeteria_daily_menus daily_menu
      join public.cafeteria_menu_items menu_item
        on menu_item.school_id = daily_menu.school_id
       and menu_item.id = daily_menu.menu_item_id
     where daily_menu.school_id = target_school_id
       and daily_menu.menu_item_id = v_menu_item_id
       and daily_menu.service_date = current_local_date
       and daily_menu.is_available
       and menu_item.is_active
     for update of daily_menu, menu_item;
    if not found then
      raise exception 'The selected item is not on today''s available cafeteria menu.';
    end if;
    if not exists (
      select 1 from public.cafeteria_recipe_ingredients recipe
       where recipe.school_id = target_school_id
         and recipe.menu_item_id = v_menu_item_id
    ) then
      raise exception 'Add recipe stock ingredients before selling this menu item.';
    end if;

    select coalesce(sum(order_item.quantity), 0)
      into v_sold_quantity
      from public.cafeteria_order_items order_item
      join public.cafeteria_orders cafeteria_order
        on cafeteria_order.school_id = order_item.school_id
       and cafeteria_order.id = order_item.order_id
     where order_item.school_id = target_school_id
       and order_item.menu_item_id = v_menu_item_id
       and cafeteria_order.order_date = current_local_date;
    if v_menu_quantity_limit is not null and v_sold_quantity + v_item_quantity > v_menu_quantity_limit then
      raise exception 'The selected item exceeds the remaining daily menu quantity.';
    end if;
    order_total := order_total + v_menu_price * v_item_quantity;
  end loop;

  payment_total := round(target_initial_payment, 2);
  if payment_total > order_total then
    raise exception 'Initial payment cannot exceed the order total.';
  end if;

  insert into public.cafeteria_order_sequences (school_id, order_date, last_value)
  values (target_school_id, current_local_date, 1)
  on conflict (school_id, order_date) do update
     set last_value = public.cafeteria_order_sequences.last_value + 1
   where public.cafeteria_order_sequences.last_value < 999999
  returning last_value into order_sequence;
  if not found then
    raise exception 'The cafeteria order number sequence is full for today.';
  end if;
  generated_order_number := 'CAF-' || to_char(current_local_date, 'YYYYMMDD') || '-' || lpad(order_sequence::text, 5, '0');

  insert into public.cafeteria_orders (
    school_id, order_number, order_date, customer_label, total_amount, created_by
  ) values (
    target_school_id, generated_order_number, current_local_date,
    nullif(trim(target_customer_label), ''), order_total, auth.uid()
  ) returning id into order_id;

  for line_record in
    select value as line
      from jsonb_array_elements(target_order_lines)
     order by value ->> 'menuItemId'
  loop
    v_menu_item_id := (line_record.line ->> 'menuItemId')::uuid;
    v_item_quantity := (line_record.line ->> 'quantity')::integer;
    select price into v_menu_price
      from public.cafeteria_menu_items
     where school_id = target_school_id and id = v_menu_item_id;

    insert into public.cafeteria_order_items (
      school_id, order_id, menu_item_id, quantity, unit_price, line_total
    ) values (
      target_school_id, order_id, v_menu_item_id, v_item_quantity, v_menu_price, v_menu_price * v_item_quantity
    );

    for ingredient_record in
      select recipe.stock_item_id, recipe.quantity_per_portion * v_item_quantity as quantity,
             stock_item.cost_per_unit
        from public.cafeteria_recipe_ingredients recipe
        join public.cafeteria_stock_items stock_item
          on stock_item.school_id = recipe.school_id
         and stock_item.id = recipe.stock_item_id
       where recipe.school_id = target_school_id
         and recipe.menu_item_id = v_menu_item_id
       order by recipe.stock_item_id
    loop
      insert into public.cafeteria_stock_transactions (
        school_id, stock_item_id, transaction_type, quantity, unit_cost, reference, notes, created_by
      ) values (
        target_school_id, ingredient_record.stock_item_id, 'stock_out', ingredient_record.quantity,
        ingredient_record.cost_per_unit, generated_order_number, 'Recipe ingredient used for cafeteria order.',
        auth.uid()
      );
    end loop;
  end loop;

  if payment_total > 0 then
    insert into public.cafeteria_payments (
      school_id, order_id, amount, payment_method, payment_reference, received_by
    ) values (
      target_school_id, order_id, payment_total, target_payment_method,
      nullif(trim(target_payment_reference), ''), auth.uid()
    );
  end if;
  return order_id;
end;
$$;

create or replace function public.record_cafeteria_payment(
  target_school_id uuid,
  target_order_id uuid,
  target_amount numeric,
  target_payment_method text,
  target_payment_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  order_record public.cafeteria_orders%rowtype;
  received_total numeric(12,2);
  payment_id uuid;
begin
  if auth.uid() is null or not public.has_permission(target_school_id, 'cafeteria', 'manage') then
    raise exception 'Not authorized to record cafeteria payments.';
  end if;
  if target_amount is null or target_amount <= 0
     or target_amount > 10000000
     or target_payment_method is null
     or target_payment_method not in ('cash', 'card', 'transfer', 'other')
     or length(coalesce(target_payment_reference, '')) > 100 then
    raise exception 'Cafeteria payment details are invalid.';
  end if;

  select * into order_record
    from public.cafeteria_orders
   where school_id = target_school_id and id = target_order_id
   for update;
  if not found then
    raise exception 'Cafeteria order was not found.';
  end if;
  select coalesce(sum(amount), 0) into received_total
    from public.cafeteria_payments
   where school_id = target_school_id and order_id = target_order_id;
  if round(target_amount, 2) > order_record.total_amount - received_total then
    raise exception 'Payment exceeds the outstanding cafeteria order balance.';
  end if;

  insert into public.cafeteria_payments (
    school_id, order_id, amount, payment_method, payment_reference, received_by
  ) values (
    target_school_id, target_order_id, round(target_amount, 2), target_payment_method,
    nullif(trim(target_payment_reference), ''), auth.uid()
  ) returning id into payment_id;
  return payment_id;
end;
$$;

create or replace function public.set_cafeteria_order_status(
  target_school_id uuid,
  target_order_id uuid,
  target_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
begin
  if auth.uid() is null or not public.has_permission(target_school_id, 'cafeteria', 'manage') then
    raise exception 'Not authorized to update cafeteria orders.';
  end if;
  if target_status not in ('ready', 'served') then
    raise exception 'Cafeteria order status is invalid.';
  end if;

  select status into current_status
    from public.cafeteria_orders
   where school_id = target_school_id and id = target_order_id
   for update;
  if not found then
    raise exception 'Cafeteria order was not found.';
  end if;
  if not ((current_status = 'preparing' and target_status = 'ready')
       or (current_status = 'ready' and target_status = 'served')) then
    raise exception 'Cafeteria order status must advance from preparing to ready to served.';
  end if;

  update public.cafeteria_orders set status = target_status
   where school_id = target_school_id and id = target_order_id;
  return target_order_id;
end;
$$;

revoke all on function public.create_cafeteria_order(uuid, text, jsonb, numeric, text, text) from public, anon;
revoke all on function public.record_cafeteria_payment(uuid, uuid, numeric, text, text) from public, anon;
revoke all on function public.set_cafeteria_order_status(uuid, uuid, text) from public, anon;
grant execute on function public.create_cafeteria_order(uuid, text, jsonb, numeric, text, text) to authenticated;
grant execute on function public.record_cafeteria_payment(uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.set_cafeteria_order_status(uuid, uuid, text) to authenticated;
