"use client";

import { useMemo, useState } from "react";

export type InventoryItemRow = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  supplier: string;
  location: string;
  cost: number;
  formattedCost: string;
  formattedValue: string;
  quantity: number;
  minStockLevel: number;
  status: string;
};

export type InventoryTransactionRow = {
  id: string;
  itemId: string;
  itemName: string;
  sku: string;
  unit: string;
  type: string;
  quantity: number;
  formattedUnitCost: string | null;
  reference: string;
  purchaseDepartment: string;
  purchaseOrderNumber: string;
  paymentBillName: string;
  paymentBillUrl: string | null;
  notes: string;
  createdAt: string;
  createdBy: string;
};

type Tab = "items" | "movements";
type ItemFilter = "all" | "low" | "out" | "healthy" | "inactive";
type MovementFilter = "all" | "stock_in" | "stock_out" | "return" | "adjustment";

function transactionDelta(transaction: InventoryTransactionRow) {
  if (transaction.type === "stock_in" || transaction.type === "return") return transaction.quantity;
  return -transaction.quantity;
}

function StockBadge({ item }: { item: InventoryItemRow }) {
  const status = item.status !== "active" ? "inactive" : item.quantity <= 0 ? "out" : item.quantity <= item.minStockLevel ? "low" : "healthy";
  const label = status === "out" ? "Out of stock" : status === "low" ? "Low stock" : status === "healthy" ? "Healthy" : "Inactive";
  return <span className={`inventory-stock-badge inventory-stock-badge--${status}`}>{label}</span>;
}

export function InventoryRegister({
  items,
  transactions,
  formattedInventoryValue,
}: {
  items: InventoryItemRow[];
  transactions: InventoryTransactionRow[];
  formattedInventoryValue: string;
}) {
  const [tab, setTab] = useState<Tab>("items");
  const [itemFilter, setItemFilter] = useState<ItemFilter>("all");
  const [movementFilter, setMovementFilter] = useState<MovementFilter>("all");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filters = tab === "items" ? ["all", "low", "out", "healthy", "inactive"] as const : ["all", "stock_in", "stock_out", "return", "adjustment"] as const;
  const activeFilter = tab === "items" ? itemFilter : movementFilter;
  const setActiveFilter = (value: string) => {
    if (tab === "items" && ["all", "low", "out", "healthy", "inactive"].includes(value)) setItemFilter(value as ItemFilter);
    if (tab === "movements" && ["all", "stock_in", "stock_out", "return", "adjustment"].includes(value)) setMovementFilter(value as MovementFilter);
  };
  const visibleItems = useMemo(() => items.filter((item) => {
    const status = item.status !== "active" ? "inactive" : item.quantity <= 0 ? "out" : item.quantity <= item.minStockLevel ? "low" : "healthy";
    return `${item.name} ${item.sku} ${item.category} ${item.supplier} ${item.location}`.toLocaleLowerCase().includes(normalizedQuery)
      && (itemFilter === "all" || status === itemFilter);
  }), [items, itemFilter, normalizedQuery]);
  const visibleTransactions = useMemo(() => transactions.filter((transaction) =>
    `${transaction.itemName} ${transaction.sku} ${transaction.type} ${transaction.reference} ${transaction.purchaseDepartment} ${transaction.purchaseOrderNumber} ${transaction.paymentBillName} ${transaction.notes} ${transaction.createdBy}`.toLocaleLowerCase().includes(normalizedQuery)
    && (movementFilter === "all" || transaction.type === movementFilter),
  ), [transactions, movementFilter, normalizedQuery]);
  const lowStockCount = items.filter((item) => item.status === "active" && item.quantity <= item.minStockLevel).length;
  const movementTypeLabel: Record<string, string> = { stock_in: "Stock received", stock_out: "Issued / consumed", return: "Returned", adjustment: "Adjustment" };

  function selectTab(next: Tab) {
    setTab(next);
    setQuery("");
    setItemFilter("all");
    setMovementFilter("all");
  }

  return <section className="inventory-register" aria-label="Inventory register">
    <div className="inventory-register__heading"><div><p className="module-page-header__eyebrow">Stock register</p><h2>Monitor items and stock movements</h2><p>Current inventory value estimate: <strong>{formattedInventoryValue}</strong> <span>·</span> {lowStockCount} items at or below reorder level</p></div><span className="inventory-register__count">{items.length} items · {transactions.length} movements</span></div>
    <div className="inventory-register__toolbar">
      <div className="inventory-register__tabs" role="tablist" aria-label="Inventory records">
        <button type="button" role="tab" aria-selected={tab === "items"} className={tab === "items" ? "active" : ""} onClick={() => selectTab("items")}>Items</button>
        <button type="button" role="tab" aria-selected={tab === "movements"} className={tab === "movements" ? "active" : ""} onClick={() => selectTab("movements")}>Movement ledger</button>
      </div>
      <label className="inventory-register__search"><span className="sr-only">Search inventory records</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "items" ? "Search item, SKU, category, supplier…" : "Search item, reference, notes…"}/></label>
    </div>
    <div className="inventory-register__filters" role="group" aria-label="Inventory filters">
      {filters.map((filter) => <button key={filter} type="button" aria-pressed={activeFilter === filter} className={activeFilter === filter ? "active" : ""} onClick={() => setActiveFilter(filter)}>{filter === "all" ? "All" : filter.replaceAll("_", " ")}</button>)}
    </div>
    {tab === "items" ? <div className="inventory-item-list">
      {visibleItems.length ? visibleItems.map((item) => {
        const stockPercent = item.minStockLevel > 0 ? Math.min(100, Math.round(item.quantity / item.minStockLevel * 100)) : item.quantity > 0 ? 100 : 0;
        return <article className={`inventory-item-card${item.status === "active" && item.quantity <= item.minStockLevel ? " inventory-item-card--alert" : ""}`} key={item.id}>
          <div className="inventory-item-card__identity"><span className="inventory-item-card__icon" aria-hidden="true">{item.name.slice(0, 1).toUpperCase()}</span><div><h3>{item.name}</h3><p>{item.sku} <span>·</span> {item.category}</p></div></div>
          <StockBadge item={item} />
          <div className="inventory-item-card__quantity"><strong>{item.quantity}</strong><span>{item.unit} on hand</span><div className="inventory-item-card__bar"><i style={{ width: `${stockPercent}%` }} /></div><small>Reorder at {item.minStockLevel} {item.unit}</small></div>
          <div className="inventory-item-card__details"><span>Unit cost<strong>{item.formattedCost}</strong></span><span>Value<strong>{item.formattedValue}</strong></span><span>Location<strong>{item.location || "Not set"}</strong></span><span>Supplier<strong>{item.supplier || "Not assigned"}</strong></span></div>
        </article>;
      }) : <div className="inventory-register__empty"><h3>No matching inventory items</h3><p>Try another search or status filter.</p></div>}
    </div> : <div className="inventory-movement-list">
      {visibleTransactions.length ? visibleTransactions.map((transaction) => {
        const delta = transactionDelta(transaction);
        return <article className="inventory-movement-row" key={transaction.id}>
          <span className={`inventory-movement-row__icon inventory-movement-row__icon--${transaction.type}`}>{delta > 0 ? "+" : delta < 0 ? "−" : "·"}</span>
          <div className="inventory-movement-row__item"><strong>{transaction.itemName}</strong><span>{transaction.sku} <i>·</i> {movementTypeLabel[transaction.type] ?? transaction.type.replaceAll("_", " ")}</span>{transaction.notes && <small>{transaction.notes}</small>}</div>
          <div className={`inventory-movement-row__quantity${delta < 0 ? " is-negative" : " is-positive"}`}><strong>{delta > 0 ? "+" : ""}{delta} {transaction.unit}</strong><span>Qty entered: {transaction.quantity}</span></div>
          <div className="inventory-movement-row__meta"><span>{transaction.reference || "No reference"}</span><small>{transaction.createdAt} · {transaction.createdBy || "Staff"}</small>{transaction.formattedUnitCost !== null && <small>Unit cost {transaction.formattedUnitCost}</small>}{transaction.purchaseDepartment && <small>Department: {transaction.purchaseDepartment}</small>}{transaction.purchaseOrderNumber && <small>PO: {transaction.purchaseOrderNumber}</small>}{transaction.paymentBillUrl && <a className="inventory-bill-link" href={transaction.paymentBillUrl} target="_blank" rel="noreferrer">View bill{transaction.paymentBillName ? ` · ${transaction.paymentBillName}` : ""}</a>}</div>
        </article>;
      }) : <div className="inventory-register__empty"><h3>No matching stock movements</h3><p>Record a movement to build the item ledger.</p></div>}
    </div>}
  </section>;
}
