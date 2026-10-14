import { redirect } from "next/navigation";

import { CafeteriaActionsPanel } from "@/components/cafeteria/cafeteria-actions-panel";
import {
  CafeteriaRegister,
  type CafeteriaDailyMenuRow,
  type CafeteriaMenuRow,
  type CafeteriaOrderRow,
  type CafeteriaRecipeRow,
  type CafeteriaStockRow,
  type CafeteriaTransactionRow,
} from "@/components/cafeteria/cafeteria-register";
import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { createClient } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;

function relation<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function schoolDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function displayDate(value: string, locale: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function displayDateTime(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }).format(date);
}

export default async function CafeteriaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { schoolId, schoolName, isMasterAdmin } = await getActiveSchoolContext(supabase, user.id);
  if (!schoolId) redirect(isMasterAdmin ? "/admin" : "/setup?onboarding=1");

  const [
    { data: canView, error: viewPermissionError },
    { data: canManage, error: managePermissionError },
  ] = await Promise.all([
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "cafeteria", target_action: "view" }),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "cafeteria", target_action: "manage" }),
  ]);
  if (viewPermissionError || managePermissionError) {
    console.error("Cafeteria permissions could not be checked.", { viewPermissionError, managePermissionError });
    throw new Error("Cafeteria permissions could not be verified.");
  }
  if (!canView && !canManage) redirect("/dashboard?error=not-authorized");

  const today = schoolDate();
  const firstDayOfCurrentMonth = `${today.slice(0, 7)}-01`;
  const orderStart = new Date(`${today}T00:00:00.000Z`);
  orderStart.setUTCDate(orderStart.getUTCDate() - 30);
  const ordersFrom = orderStart.toISOString().slice(0, 10);
  const [
    { data: settings, error: settingsError },
    { data: menuRecords, error: menuError },
    { data: dailyMenuRecords, error: dailyMenuError },
    { data: stockRecords, error: stockError },
    { data: recipeRecords, error: recipesError },
    { data: transactionRecords, error: transactionsError },
    { data: orderRecords, error: ordersError },
  ] = await Promise.all([
    supabase.from("school_settings").select("currency_code,locale").eq("school_id", schoolId).maybeSingle(),
    supabase.from("cafeteria_menu_items").select("id,name,category,description,price,allergens,is_active").eq("school_id", schoolId).order("name").limit(2000),
    supabase.from("cafeteria_daily_menus")
      .select("id,menu_item_id,service_date,meal_period,quantity_limit,is_available,cafeteria_menu_items(name,category,price,is_active)")
      .eq("school_id", schoolId).gte("service_date", firstDayOfCurrentMonth).order("service_date", { ascending: true }).limit(5000),
    supabase.from("cafeteria_stock_items").select("id,name,sku,unit,cost_per_unit,current_quantity,reorder_level,is_active").eq("school_id", schoolId).order("name").limit(3000),
    supabase.from("cafeteria_recipe_ingredients")
      .select("id,menu_item_id,stock_item_id,quantity_per_portion,cafeteria_menu_items(name),cafeteria_stock_items(name,unit)")
      .eq("school_id", schoolId).order("created_at", { ascending: false }).limit(5000),
    supabase.from("cafeteria_stock_transactions")
      .select("id,stock_item_id,transaction_type,quantity,unit_cost,reference,notes,created_at,cafeteria_stock_items(name,unit)")
      .eq("school_id", schoolId).order("created_at", { ascending: false }).limit(3000),
    supabase.from("cafeteria_orders")
      .select("id,order_number,order_date,customer_label,status,total_amount,created_at,cafeteria_order_items(quantity,line_total,menu_item_id,cafeteria_menu_items(name)),cafeteria_payments(amount,payment_method)")
      .eq("school_id", schoolId).gte("order_date", ordersFrom).order("created_at", { ascending: false }).limit(3000),
  ]);
  if (settingsError || menuError || dailyMenuError || stockError || recipesError || transactionsError || ordersError) {
    console.error("Cafeteria workspace data could not be loaded.", { settingsError, menuError, dailyMenuError, stockError, recipesError, transactionsError, ordersError });
    throw new Error("Food and Cafeteria workspace data could not be loaded.");
  }
  if (!settings) {
    console.error("Cafeteria currency settings are not configured for this school.", { schoolId });
    throw new Error("School currency settings must be configured before cafeteria values can be displayed.");
  }

  const locale = settings.locale.trim();
  const currency = settings.currency_code.trim();
  const formatCurrency = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  const recipeCountByItem = new Map<string, number>();
  const recipes: CafeteriaRecipeRow[] = (recipeRecords ?? []).map((record) => {
    const menuItem = relation<{ name: string | null }>(record.cafeteria_menu_items);
    const stockItem = relation<{ name: string | null; unit: string | null }>(record.cafeteria_stock_items);
    recipeCountByItem.set(String(record.menu_item_id), (recipeCountByItem.get(String(record.menu_item_id)) ?? 0) + 1);
    return {
      id: String(record.id),
      itemName: menuItem?.name ?? "Unknown menu item",
      stockName: stockItem?.name ?? "Unknown ingredient",
      quantityPerPortion: Number(record.quantity_per_portion),
      unit: stockItem?.unit ?? "",
    };
  });
  const menuItems: CafeteriaMenuRow[] = (menuRecords ?? []).map((record) => ({
    id: String(record.id),
    name: String(record.name),
    category: String(record.category),
    description: String(record.description ?? ""),
    priceLabel: formatCurrency(Number(record.price)),
    allergens: String(record.allergens ?? ""),
    isActive: Boolean(record.is_active),
    ingredientCount: recipeCountByItem.get(String(record.id)) ?? 0,
  }));
  const menuOptionItems = menuItems.filter((item) => (menuRecords ?? []).some((record) => String(record.id) === item.id && record.is_active))
    .map((item) => ({ id: item.id, name: `${item.name} · ${item.category}` }));

  type RawOrderItem = {
    quantity: number;
    line_total: number;
    menu_item_id: string;
    cafeteria_menu_items: Relation<{ name: string | null }>;
  };
  type RawPayment = { amount: number; payment_method: string };
  type RawOrder = {
    id: string;
    order_number: string;
    order_date: string;
    customer_label: string | null;
    status: string;
    total_amount: number;
    created_at: string;
    cafeteria_order_items: Relation<RawOrderItem[]>;
    cafeteria_payments: Relation<RawPayment[]>;
  };
  const orderRows = (orderRecords ?? []) as RawOrder[];
  const soldByMenuDate = new Map<string, number>();
  const orders: CafeteriaOrderRow[] = orderRows.map((order) => {
    const lines = relation<RawOrderItem[]>(order.cafeteria_order_items) ?? [];
    const payments = relation<RawPayment[]>(order.cafeteria_payments) ?? [];
    for (const line of lines) {
      const key = `${order.order_date}:${line.menu_item_id}`;
      soldByMenuDate.set(key, (soldByMenuDate.get(key) ?? 0) + Number(line.quantity));
    }
    const totalAmount = Number(order.total_amount);
    const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const outstanding = Math.max(0, totalAmount - paidAmount);
    const paymentStatus = outstanding < 0.005 ? "paid" : paidAmount > 0 ? "partial" : "unpaid";
    return {
      id: String(order.id),
      orderNumber: String(order.order_number),
      orderDate: String(order.order_date),
      dateLabel: displayDateTime(String(order.created_at), locale),
      customerLabel: String(order.customer_label ?? ""),
      status: String(order.status),
      paymentStatus,
      totalAmount,
      paidAmount,
      outstanding,
      totalLabel: formatCurrency(totalAmount),
      paidLabel: formatCurrency(paidAmount),
      outstandingLabel: formatCurrency(outstanding),
      paymentMethods: [...new Set(payments.map((payment) => payment.payment_method))].join(", "),
      lines: lines.map((line) => ({
        itemName: relation<{ name: string | null }>(line.cafeteria_menu_items)?.name ?? "Menu item",
        quantity: Number(line.quantity),
        totalLabel: formatCurrency(Number(line.line_total)),
      })),
    };
  });
  const dailyMenu: CafeteriaDailyMenuRow[] = (dailyMenuRecords ?? []).map((record) => {
    const item = relation<{ name: string | null; category: string | null; price: number; is_active: boolean }>(record.cafeteria_menu_items);
    const itemId = String(record.menu_item_id);
    const serviceDate = String(record.service_date);
    const soldQuantity = soldByMenuDate.get(`${serviceDate}:${itemId}`) ?? 0;
    return {
      id: String(record.id),
      menuItemId: itemId,
      itemName: item?.name ?? "Unknown menu item",
      category: item?.category ?? "other",
      serviceDate,
      serviceDateLabel: displayDate(serviceDate, locale),
      mealPeriod: String(record.meal_period),
      priceLabel: formatCurrency(Number(item?.price ?? 0)),
      quantityLimit: record.quantity_limit === null ? null : Number(record.quantity_limit),
      soldQuantity,
      isAvailable: Boolean(record.is_available && item?.is_active),
      recipeReady: (recipeCountByItem.get(itemId) ?? 0) > 0,
    };
  });
  const orderableItems = dailyMenu
    .filter((item) => item.serviceDate === today && item.isAvailable && item.recipeReady
      && (item.quantityLimit === null || item.soldQuantity < item.quantityLimit))
    .map((item) => {
      const source = (menuRecords ?? []).find((record) => String(record.id) === item.menuItemId);
      return { id: item.menuItemId, name: `${item.itemName} · ${item.mealPeriod}`, priceLabel: formatCurrency(Number(source?.price ?? 0)) };
    })
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
  const stockItems: CafeteriaStockRow[] = (stockRecords ?? []).map((record) => {
    const currentQuantity = Number(record.current_quantity);
    const reorderLevel = Number(record.reorder_level);
    const status = currentQuantity <= 0 ? "out" : currentQuantity <= reorderLevel ? "low" : "healthy";
    return {
      id: String(record.id),
      name: String(record.name),
      sku: String(record.sku ?? ""),
      unit: String(record.unit),
      currentQuantity,
      currentQuantityLabel: currentQuantity.toLocaleString(locale, { maximumFractionDigits: 3 }),
      reorderLevel,
      costLabel: formatCurrency(Number(record.cost_per_unit)),
      stockValueLabel: formatCurrency(currentQuantity * Number(record.cost_per_unit)),
      status,
    };
  });
  const stockOptions = (stockRecords ?? []).filter((record) => record.is_active).map((record) => ({
    id: String(record.id),
    name: String(record.name),
    unit: String(record.unit),
  }));
  const stockById = new Map(stockItems.map((item) => [item.id, item]));
  const transactions: CafeteriaTransactionRow[] = (transactionRecords ?? []).map((record) => {
    const stockItem = relation<{ name: string | null; unit: string | null }>(record.cafeteria_stock_items);
    return {
      id: String(record.id),
      stockName: stockItem?.name ?? stockById.get(String(record.stock_item_id))?.name ?? "Ingredient",
      unit: stockItem?.unit ?? "",
      movement: String(record.transaction_type),
      quantity: Number(record.quantity),
      quantityLabel: `${Number(record.quantity).toLocaleString(locale, { maximumFractionDigits: 3 })} ${stockItem?.unit ?? ""}`,
      unitCostLabel: record.unit_cost === null ? "—" : formatCurrency(Number(record.unit_cost)),
      reference: String(record.reference ?? ""),
      notes: String(record.notes ?? ""),
      dateLabel: displayDateTime(String(record.created_at), locale),
    };
  });

  const todayOrders = orders.filter((order) => order.orderDate === today);
  const todaySales = todayOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const todayCollected = todayOrders.reduce((sum, order) => sum + order.paidAmount, 0);
  const todayOutstanding = todayOrders.reduce((sum, order) => sum + order.outstanding, 0);
  const lowStockCount = stockItems.filter((item) => item.status !== "healthy").length;

  return <main className="cafeteria-shell">
    <header className="module-page-header cafeteria-page-header">
      <div className="module-page-header__row">
        <div><p className="module-page-header__eyebrow">Operations / Food service</p><h1>Food &amp; Cafeteria</h1><p>Plan menus, manage ingredient stock, serve meal orders, and reconcile collections in one school-scoped workspace.</p></div>
        <a className="cafeteria-page-header__action" href="#cafeteria-actions">Open workflows <span aria-hidden="true">↓</span></a>
      </div>
    </header>

    <section className="cafeteria-hero" aria-label="Cafeteria daily summary">
      <div className="cafeteria-hero__copy"><span className="cafeteria-hero__eyebrow"><i /> TODAY’S SERVICE · {today}</span><h2>A clear view of kitchen, counter, and collections.</h2><p>Daily menus enforce portion limits. Recipe-based orders deduct ingredients and record payments in a single transaction.</p></div>
      <div className="cafeteria-hero__badge" aria-hidden="true"><span>F&amp;C</span><i>✦</i></div>
    </section>

    <section className="cafeteria-kpis" aria-label="Cafeteria metrics">
      <article className="cafeteria-kpi"><span>Orders today</span><strong>{todayOrders.length}</strong><small>{orders.length} in the last 30 days</small></article>
      <article className="cafeteria-kpi"><span>Sales today</span><strong>{formatCurrency(todaySales)}</strong><small>From accepted orders</small></article>
      <article className="cafeteria-kpi"><span>Collected today</span><strong>{formatCurrency(todayCollected)}</strong><small>Cash, card, transfer, and other</small></article>
      <article className={`cafeteria-kpi ${todayOutstanding > 0 ? "cafeteria-kpi--alert" : ""}`}><span>Outstanding today</span><strong>{formatCurrency(todayOutstanding)}</strong><small>Part-paid and unpaid orders</small></article>
      <article className={`cafeteria-kpi ${lowStockCount > 0 ? "cafeteria-kpi--warning" : ""}`}><span>Stock alerts</span><strong>{lowStockCount}</strong><small>At or below reorder thresholds</small></article>
    </section>

    <CafeteriaActionsPanel
      menuItems={menuOptionItems}
      orderableItems={orderableItems}
      stockItems={stockOptions}
      today={today}
      scheduledEntries={dailyMenu.map((item) => ({
        menuItemId: item.menuItemId,
        serviceDate: item.serviceDate,
        mealPeriod: item.mealPeriod as "breakfast" | "lunch" | "snack",
      }))}
      canManage={Boolean(canManage)}
    />
    <CafeteriaRegister
      menuItems={menuItems}
      dailyMenu={dailyMenu}
      stockItems={stockItems}
      recipes={recipes}
      transactions={transactions}
      orders={orders}
      canManage={Boolean(canManage)}
      today={today}
      schoolName={schoolName ?? "School"}
    />
  </main>;
}
