"use client";

import { useMemo, useState } from "react";

import {
  CafeteriaDailyMenuStatusForm,
  CafeteriaMenuItemStatusForm,
  CafeteriaOrderStatusForm,
  CafeteriaPaymentForm,
} from "@/components/cafeteria/cafeteria-forms";

export type CafeteriaMenuRow = {
  id: string;
  name: string;
  category: string;
  description: string;
  priceLabel: string;
  allergens: string;
  isActive: boolean;
  ingredientCount: number;
};

export type CafeteriaDailyMenuRow = {
  id: string;
  menuItemId: string;
  itemName: string;
  category: string;
  serviceDate: string;
  serviceDateLabel: string;
  mealPeriod: string;
  priceLabel: string;
  quantityLimit: number | null;
  soldQuantity: number;
  isAvailable: boolean;
  recipeReady: boolean;
};

export type CafeteriaStockRow = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  currentQuantity: number;
  currentQuantityLabel: string;
  reorderLevel: number;
  costLabel: string;
  stockValueLabel: string;
  status: "healthy" | "low" | "out";
};

export type CafeteriaRecipeRow = {
  id: string;
  itemName: string;
  stockName: string;
  quantityPerPortion: number;
  unit: string;
};

export type CafeteriaTransactionRow = {
  id: string;
  stockName: string;
  unit: string;
  movement: string;
  quantity: number;
  quantityLabel: string;
  unitCostLabel: string;
  reference: string;
  notes: string;
  dateLabel: string;
};

export type CafeteriaOrderLine = {
  itemName: string;
  quantity: number;
  totalLabel: string;
};

export type CafeteriaOrderRow = {
  id: string;
  orderNumber: string;
  orderDate: string;
  dateLabel: string;
  customerLabel: string;
  status: string;
  paymentStatus: "paid" | "partial" | "unpaid";
  totalAmount: number;
  paidAmount: number;
  outstanding: number;
  totalLabel: string;
  paidLabel: string;
  outstandingLabel: string;
  lines: CafeteriaOrderLine[];
  paymentMethods: string;
};

type RegisterTab = "menu" | "daily" | "monthly" | "stock" | "recipes" | "movements" | "sales";
type Filter = "all" | "active" | "paused" | "today" | "upcoming" | "unavailable" | "low" | "out" | "healthy" | "unpaid" | "partial" | "paid" | "preparing" | "ready" | "served" | "stock_in" | "stock_out" | "waste" | "adjustment_add" | "adjustment_remove";

function StatusBadge({ status }: { status: string }) {
  return <span className={`cafeteria-status cafeteria-status--${status}`}>{status.replaceAll("_", " ")}</span>;
}

export function CafeteriaRegister({
  menuItems,
  dailyMenu,
  stockItems,
  recipes,
  transactions,
  orders,
  canManage,
  today,
  schoolName,
}: {
  menuItems: CafeteriaMenuRow[];
  dailyMenu: CafeteriaDailyMenuRow[];
  stockItems: CafeteriaStockRow[];
  recipes: CafeteriaRecipeRow[];
  transactions: CafeteriaTransactionRow[];
  orders: CafeteriaOrderRow[];
  canManage: boolean;
  today: string;
  schoolName: string;
}) {
  const [tab, setTab] = useState<RegisterTab>("sales");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const visibleMenu = useMemo(() => menuItems.filter((item) => {
    const matches = `${item.name} ${item.category} ${item.description} ${item.allergens}`.toLocaleLowerCase().includes(normalizedQuery);
    return matches && (filter === "all" || (filter === "active" && item.isActive) || (filter === "paused" && !item.isActive));
  }), [menuItems, filter, normalizedQuery]);
  const visibleDaily = useMemo(() => dailyMenu.filter((item) => {
    const matches = `${item.itemName} ${item.category} ${item.mealPeriod} ${item.serviceDate}`.toLocaleLowerCase().includes(normalizedQuery);
    return matches && (filter === "all" || (filter === "today" && item.serviceDate === today) || (filter === "upcoming" && item.serviceDate > today) || (filter === "unavailable" && !item.isAvailable));
  }), [dailyMenu, filter, normalizedQuery, today]);
  const monthlyDaily = useMemo(() => dailyMenu.filter((item) => item.serviceDate.startsWith(`${selectedMonth}-`)), [dailyMenu, selectedMonth]);
  const monthlyMenuBySlot = useMemo(() => {
    const result = new Map<string, CafeteriaDailyMenuRow[]>();
    for (const item of monthlyDaily) {
      const key = `${item.serviceDate}:${item.mealPeriod}`;
      result.set(key, [...(result.get(key) ?? []), item]);
    }
    return result;
  }, [monthlyDaily]);
  const [, monthYearValue, monthNumberValue] = selectedMonth.match(/^(\d{4})-(\d{2})$/) ?? [];
  const monthYear = Number(monthYearValue);
  const monthNumber = Number(monthNumberValue);
  const monthDayCount = monthYear && monthNumber ? new Date(Date.UTC(monthYear, monthNumber, 0)).getUTCDate() : 0;
  const monthLabel = monthYear && monthNumber
    ? new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(monthYear, monthNumber - 1, 1)))
    : selectedMonth;
  const schoolMark = schoolName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase() ?? "").join("") || "S";
  const visibleStock = useMemo(() => stockItems.filter((item) => {
    const matches = `${item.name} ${item.sku} ${item.unit}`.toLocaleLowerCase().includes(normalizedQuery);
    return matches && (filter === "all" || item.status === filter);
  }), [stockItems, filter, normalizedQuery]);
  const visibleRecipes = useMemo(() => recipes.filter((item) => `${item.itemName} ${item.stockName}`.toLocaleLowerCase().includes(normalizedQuery)), [recipes, normalizedQuery]);
  const visibleTransactions = useMemo(() => transactions.filter((item) => {
    const matches = `${item.stockName} ${item.movement} ${item.reference} ${item.notes}`.toLocaleLowerCase().includes(normalizedQuery);
    return matches && (filter === "all" || item.movement === filter);
  }), [transactions, filter, normalizedQuery]);
  const visibleOrders = useMemo(() => orders.filter((order) => {
    const matches = `${order.orderNumber} ${order.customerLabel} ${order.status} ${order.paymentStatus} ${order.lines.map((line) => line.itemName).join(" ")}`.toLocaleLowerCase().includes(normalizedQuery);
    return matches && (filter === "all" || order.status === filter || order.paymentStatus === filter);
  }), [orders, filter, normalizedQuery]);

  const filters: Filter[] = tab === "menu"
    ? ["all", "active", "paused"]
    : tab === "daily"
      ? ["all", "today", "upcoming", "unavailable"]
      : tab === "stock"
        ? ["all", "low", "out", "healthy"]
        : tab === "sales"
          ? ["all", "unpaid", "partial", "paid", "preparing", "ready", "served"]
          : tab === "movements"
            ? ["all", "stock_in", "stock_out", "waste", "adjustment_add", "adjustment_remove"]
            : ["all"];

  function changeTab(next: RegisterTab) {
    setTab(next);
    setFilter("all");
    setQuery("");
  }

  return <section className="cafeteria-register" aria-label="Cafeteria records">
    <div className="cafeteria-register__heading">
      <div><p className="cafeteria-eyebrow">Cafeteria register</p><h2>Live operations and records</h2><p>Find scheduled food, manage ingredients, and follow each order through payment and service.</p></div>
      <div className="cafeteria-register__counts"><span>{menuItems.length} menu items</span><span>{stockItems.filter((item) => item.status !== "healthy").length} stock alerts</span><span>{orders.filter((order) => order.outstanding > 0).length} balances due</span></div>
    </div>
    <div className="cafeteria-register__toolbar">
      <div className="cafeteria-register__tabs" role="tablist" aria-label="Cafeteria records">
        {(["menu", "daily", "monthly", "stock", "recipes", "movements", "sales"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} onClick={() => changeTab(item)}>{item === "menu" ? "Menu" : item === "daily" ? "Daily plan" : item === "monthly" ? "Monthly menu" : item === "stock" ? "Ingredients" : item === "recipes" ? "Recipes" : item === "movements" ? "Stock ledger" : "Orders & payments"}</button>)}
      </div>
      {tab !== "monthly" && <label className="cafeteria-search"><span className="sr-only">Search cafeteria records</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "sales" ? "Search order, item, customer…" : tab === "stock" || tab === "movements" || tab === "recipes" ? "Search ingredient, SKU, reference…" : "Search menu item, category, date…"} /></label>}
    </div>
    {filters.length > 1 && <div className="cafeteria-register__filters" role="group" aria-label={`${tab} filters`}>
      {filters.map((item) => <button key={item} type="button" className={filter === item ? "active" : ""} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === "all" ? "All" : item.replaceAll("_", " ")}</button>)}
    </div>}

    {tab === "menu" && <div className="cafeteria-menu-grid">
      {visibleMenu.length ? visibleMenu.map((item) => <article className="cafeteria-menu-card" key={item.id}>
        <div className="cafeteria-menu-card__top"><span className="cafeteria-menu-card__icon" aria-hidden="true">{item.category === "beverage" ? "◉" : item.category === "breakfast" ? "☼" : "✦"}</span><StatusBadge status={item.isActive ? "active" : "paused"} /></div>
        <h3>{item.name}</h3><p className="cafeteria-menu-card__category">{item.category}</p>
        {item.description && <p className="cafeteria-menu-card__description">{item.description}</p>}
        <div className="cafeteria-menu-card__meta"><strong>{item.priceLabel}</strong><span>{item.ingredientCount} recipe ingredients</span></div>
        {item.allergens && <p className="cafeteria-allergens"><strong>Allergens</strong> {item.allergens}</p>}
        {canManage && <CafeteriaMenuItemStatusForm menuItemId={item.id} isActive={item.isActive} />}
      </article>) : <EmptyState title="No menu items found" text="Add a menu item or change the search and filter." />}
    </div>}

    {tab === "daily" && <div className="cafeteria-list">
      {visibleDaily.length ? visibleDaily.map((item) => {
        const remaining = item.quantityLimit === null ? null : Math.max(0, item.quantityLimit - item.soldQuantity);
        return <article className="cafeteria-daily-card" key={item.id}>
          <div className="cafeteria-daily-card__date"><strong>{item.serviceDateLabel}</strong><span>{item.mealPeriod}</span></div>
          <div className="cafeteria-daily-card__item"><h3>{item.itemName}</h3><p>{item.category} · {item.priceLabel}</p></div>
          <div className="cafeteria-daily-card__availability"><StatusBadge status={!item.isAvailable ? "paused" : item.recipeReady ? "active" : "setup"} /><span>{item.quantityLimit === null ? `${item.soldQuantity} sold · no cap` : `${item.soldQuantity} / ${item.quantityLimit} sold · ${remaining} left`}</span></div>
          {canManage && <CafeteriaDailyMenuStatusForm dailyMenuId={item.id} isAvailable={item.isAvailable} />}
        </article>;
      }) : <EmptyState title="No daily menu entries" text="Plan a menu for today or a future date to start taking orders." />}
    </div>}

    {tab === "monthly" && <div className="cafeteria-monthly-view">
      <div className="cafeteria-monthly-view__toolbar">
        <label className="student-field">Menu month<input type="month" min={today.slice(0, 7)} value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} /></label>
        <button type="button" className="cafeteria-monthly-view__print" onClick={() => window.print()} disabled={!monthlyDaily.length}>Print monthly menu</button>
      </div>
      <div id="cafeteria-monthly-print" className="cafeteria-monthly-print">
        <header className="cafeteria-monthly-print__header">
          <span className="cafeteria-monthly-print__mark" aria-hidden="true">{schoolMark}</span>
          <div className="cafeteria-monthly-print__identity"><p>{schoolName}</p><h2>Cafeteria Monthly Menu</h2><span>Official food service schedule</span></div>
          <div className="cafeteria-monthly-print__month"><span>MENU FOR</span><strong>{monthLabel}</strong><small>Breakfast · Lunch · Snack</small></div>
        </header>
        {monthlyDaily.length ? <div className="cafeteria-table-wrap"><table className="cafeteria-table cafeteria-monthly-table">
          <thead><tr><th>Date</th><th>Breakfast</th><th>Lunch</th><th>Snack</th></tr></thead>
          <tbody>{Array.from({ length: monthDayCount }, (_, index) => {
            const date = `${selectedMonth}-${String(index + 1).padStart(2, "0")}`;
            const label = new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`));
            const itemsFor = (period: CafeteriaDailyMenuRow["mealPeriod"]) => monthlyMenuBySlot.get(`${date}:${period}`) ?? [];
            return <tr key={date}>
              <th scope="row">{label}</th>
              {(["breakfast", "lunch", "snack"] as const).map((period) => <td key={period}>{itemsFor(period).map((item) => <span className="cafeteria-monthly-table__item" key={item.id}>{item.itemName}{!item.isAvailable ? " (unavailable)" : ""}</span>)}</td>)}
            </tr>;
          })}</tbody>
        </table></div> : <EmptyState title="No menu items scheduled this month" text="Use Plan monthly menu to schedule items, then return here to print the full-month menu." />}
        <footer className="cafeteria-monthly-print__footer"><span>{schoolName} · Food &amp; Cafeteria</span><span>Schooliva</span></footer>
      </div>
    </div>}

    {tab === "stock" && <div className="cafeteria-stock-grid">
      {visibleStock.length ? visibleStock.map((item) => <article className={`cafeteria-stock-card cafeteria-stock-card--${item.status}`} key={item.id}>
        <div className="cafeteria-stock-card__heading"><div><h3>{item.name}</h3><span>{item.sku || "No SKU"} · {item.unit}</span></div><StatusBadge status={item.status} /></div>
        <div className="cafeteria-stock-card__quantity"><strong>{item.currentQuantityLabel}</strong><span>{item.unit} on hand</span></div>
        <div className="cafeteria-stock-card__track"><i style={{ width: `${item.reorderLevel > 0 ? Math.min(100, Math.round(item.currentQuantity / (item.reorderLevel * 2) * 100)) : item.currentQuantity > 0 ? 100 : 0}%` }} /></div>
        <div className="cafeteria-stock-card__meta"><span>Reorder at <strong>{item.reorderLevel} {item.unit}</strong></span><span>Value <strong>{item.stockValueLabel}</strong></span></div>
        <small>Unit cost {item.costLabel}</small>
      </article>) : <EmptyState title="No stock items found" text="Add cafeteria ingredients and record a stock receipt." />}
    </div>}

    {tab === "recipes" && <div className="cafeteria-table-wrap"><table className="cafeteria-table"><thead><tr><th>Menu item</th><th>Ingredient</th><th>Per portion</th><th>Stock unit</th></tr></thead><tbody>
      {visibleRecipes.map((item) => <tr key={item.id}><td>{item.itemName}</td><td>{item.stockName}</td><td>{item.quantityPerPortion}</td><td>{item.unit}</td></tr>)}
      {!visibleRecipes.length && <tr><td colSpan={4}><EmptyState title="No recipe ingredients" text="Configure at least one ingredient per item before adding it to today's sales menu." /></td></tr>}
    </tbody></table></div>}

    {tab === "movements" && <div className="cafeteria-table-wrap"><table className="cafeteria-table"><thead><tr><th>Recorded</th><th>Ingredient</th><th>Movement</th><th>Quantity</th><th>Unit cost</th><th>Reference</th></tr></thead><tbody>
      {visibleTransactions.map((item) => <tr key={item.id}><td>{item.dateLabel}</td><td><strong>{item.stockName}</strong><small>{item.notes}</small></td><td><StatusBadge status={item.movement} /></td><td>{item.quantityLabel}</td><td>{item.unitCostLabel}</td><td>{item.reference || "—"}</td></tr>)}
      {!visibleTransactions.length && <tr><td colSpan={6}><EmptyState title="No stock movements" text="Receipts, waste, corrections, and recipe usage appear here." /></td></tr>}
    </tbody></table></div>}

    {tab === "sales" && <div className="cafeteria-orders">
      {visibleOrders.length ? visibleOrders.map((order) => <article className="cafeteria-order-card" key={order.id}>
        <div className="cafeteria-order-card__heading"><div><p className="cafeteria-order-card__number">{order.orderNumber}</p><h3>{order.customerLabel || "Counter order"}</h3><span>{order.dateLabel}</span></div><div className="cafeteria-order-card__badges"><StatusBadge status={order.status} /><StatusBadge status={order.paymentStatus} /></div></div>
        <div className="cafeteria-order-card__lines">{order.lines.map((line, index) => <div key={`${line.itemName}-${index}`}><span>{line.quantity} × {line.itemName}</span><strong>{line.totalLabel}</strong></div>)}</div>
        <div className="cafeteria-order-card__totals"><span>Total <strong>{order.totalLabel}</strong></span><span>Received <strong>{order.paidLabel}</strong></span><span>Balance <strong>{order.outstandingLabel}</strong></span></div>
        {order.paymentMethods && <p className="cafeteria-order-card__methods">Payment methods: {order.paymentMethods}</p>}
        <div className="cafeteria-order-card__actions">
          {canManage && order.outstanding > 0.004 && <CafeteriaPaymentForm orderId={order.id} outstanding={order.outstanding} />}
          {canManage && <CafeteriaOrderStatusForm orderId={order.id} status={order.status} />}
        </div>
      </article>) : <EmptyState title="No cafeteria orders found" text="Create an order from today's scheduled menu to see sales and payment status here." />}
    </div>}
  </section>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="cafeteria-empty"><span aria-hidden="true">✦</span><h3>{title}</h3><p>{text}</p></div>;
}
