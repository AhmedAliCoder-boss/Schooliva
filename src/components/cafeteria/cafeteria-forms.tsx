"use client";

import { useActionState, useState } from "react";

import {
  advanceCafeteriaOrder,
  createCafeteriaOrder,
  recordCafeteriaPayment,
  recordCafeteriaStockMovement,
  saveCafeteriaDailyMenu,
  saveCafeteriaMonthlyMenu,
  saveCafeteriaMenuItem,
  saveCafeteriaRecipeIngredient,
  saveCafeteriaStockItem,
  updateCafeteriaDailyMenuStatus,
  updateCafeteriaMenuItemStatus,
} from "@/app/actions/cafeteria";
import { SubmitButton } from "@/components/auth/submit-button";
import type { CafeteriaFormState } from "@/lib/cafeteria/schemas";

export type CafeteriaOption = { id: string; name: string };
export type CafeteriaOrderOption = CafeteriaOption & { priceLabel: string };
export type CafeteriaStockOption = CafeteriaOption & { unit: string };

function Feedback({ state }: { state: CafeteriaFormState | undefined }) {
  return <>{state?.error && <p className="student-error" role="alert">{state.error}</p>}{state?.success && <p className="student-success" role="status">{state.success}</p>}</>;
}

function OptionSelect({ label, name, options, disabled = false }: { label: string; name: string; options: CafeteriaOption[]; disabled?: boolean }) {
  return <label className="student-field">{label}<select name={name} required disabled={disabled}><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>;
}

export function CafeteriaMenuItemForm() {
  const [state, action] = useActionState(saveCafeteriaMenuItem, undefined);
  return <form action={action} className="student-form cafeteria-form">
    <Feedback state={state} />
    <div className="student-form-grid">
      <label className="student-field">Item name<input name="name" required maxLength={120} placeholder="e.g. Chicken sandwich" /></label>
      <label className="student-field">Category<select name="category" required defaultValue="snack"><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="snack">Snack</option><option value="beverage">Beverage</option><option value="other">Other</option></select></label>
      <label className="student-field">Selling price<input name="price" type="number" min="0" max="1000000" step="0.01" required /></label>
      <label className="student-field">Allergens<input name="allergens" maxLength={300} placeholder="e.g. milk, wheat, nuts" /></label>
      <label className="student-field student-field-wide">Description<textarea name="description" rows={2} maxLength={500} placeholder="Ingredients or serving notes" /></label>
    </div>
    <p className="cafeteria-form__hint">For traceable stock usage, add this item to a daily menu and configure at least one recipe ingredient before selling.</p>
    <SubmitButton>Add menu item</SubmitButton>
  </form>;
}

export function CafeteriaDailyMenuForm({ menuItems, today }: { menuItems: CafeteriaOption[]; today: string }) {
  const [state, action] = useActionState(saveCafeteriaDailyMenu, undefined);
  return <form action={action} className="student-form cafeteria-form">
    <Feedback state={state} />
    <div className="student-form-grid">
      <OptionSelect label="Menu item" name="menuItemId" options={menuItems} disabled={!menuItems.length} />
      <label className="student-field">Service date<input name="serviceDate" type="date" min={today} defaultValue={today} required /></label>
      <label className="student-field">Meal period<select name="mealPeriod" defaultValue="lunch"><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="snack">Snack</option></select></label>
      <label className="student-field">Portion limit (optional)<input name="quantityLimit" type="number" min="1" max="10000" placeholder="No limit" /></label>
    </div>
    <p className="cafeteria-form__hint">A daily limit is checked in the database at order time to prevent overselling.</p>
    <SubmitButton disabled={!menuItems.length}>Schedule on daily menu</SubmitButton>
  </form>;
}

export type CafeteriaMonthlyScheduleEntry = { menuItemId: string; serviceDate: string; mealPeriod: "breakfast" | "lunch" | "snack" };

export function CafeteriaMonthlyMenuForm({
  menuItems,
  today,
  scheduledEntries,
}: {
  menuItems: CafeteriaOption[];
  today: string;
  scheduledEntries: CafeteriaMonthlyScheduleEntry[];
}) {
  const [state, action] = useActionState(saveCafeteriaMonthlyMenu, undefined);
  const currentMonth = today.slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [selections, setSelections] = useState<Record<string, string>>(() => Object.fromEntries(
    scheduledEntries.map((entry) => [`${entry.serviceDate}:${entry.mealPeriod}`, entry.menuItemId]),
  ));
  const [, yearValue, monthValue] = month.match(/^(\d{4})-(\d{2})$/) ?? [];
  const year = Number(yearValue);
  const monthNumber = Number(monthValue);
  const daysInMonth = year && monthNumber ? new Date(Date.UTC(year, monthNumber, 0)).getUTCDate() : 0;
  const firstWeekday = year && monthNumber ? new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() : 0;
  const dates = Array.from({ length: daysInMonth }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
  const entries = Object.entries(selections).flatMap(([slot, menuItemId]) => {
    const separator = slot.lastIndexOf(":");
    const serviceDate = slot.slice(0, separator);
    const mealPeriod = slot.slice(separator + 1);
    return serviceDate.startsWith(`${month}-`) && menuItemId
      && (mealPeriod === "breakfast" || mealPeriod === "lunch" || mealPeriod === "snack")
      ? [{ menuItemId, serviceDate, mealPeriod }]
      : [];
  });

  return <form action={action} className="cafeteria-monthly-form">
    <Feedback state={state} />
    <div className="cafeteria-monthly-form__toolbar">
      <label className="student-field">Menu month<input type="month" name="month" min={currentMonth} value={month} onChange={(event) => setMonth(event.target.value)} required /></label>
      <p>Choose one item for breakfast, lunch, or snack on each day. Leave unused meals blank.</p>
    </div>
    <div className="cafeteria-monthly-calendar" aria-label={`Monthly menu for ${month}`}>
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div className="cafeteria-monthly-calendar__weekday" key={day}>{day}</div>)}
      {Array.from({ length: firstWeekday }, (_, index) => <div className="cafeteria-monthly-calendar__blank" key={`blank-${index}`} aria-hidden="true" />)}
      {dates.map((date, index) => <article className="cafeteria-monthly-day" key={date}>
        <h4><span>{index + 1}</span><time dateTime={date}>{new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`))}</time></h4>
        {(["breakfast", "lunch", "snack"] as const).map((period) => {
          const slot = `${date}:${period}`;
          return <label className="cafeteria-monthly-day__meal" key={period}>{period}
            <select value={selections[slot] ?? ""} disabled={!menuItems.length} aria-label={`${date} ${period}`} onChange={(event) => setSelections((current) => ({ ...current, [slot]: event.target.value }))}>
              <option value="">—</option>
              {menuItems.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>;
        })}
      </article>)}
    </div>
    <input type="hidden" name="entries" value={JSON.stringify(entries)} />
    <p className="cafeteria-form__hint">Saving updates the selected date-and-meal slots. Unselected dates and other existing daily menu entries are left unchanged. Monthly-plan entries have no portion cap.</p>
    <SubmitButton disabled={!menuItems.length || !entries.length}>{`Save monthly menu (${entries.length} slots)`}</SubmitButton>
  </form>;
}

export function CafeteriaStockItemForm() {
  const [state, action] = useActionState(saveCafeteriaStockItem, undefined);
  return <form action={action} className="student-form cafeteria-form">
    <Feedback state={state} />
    <div className="student-form-grid">
      <label className="student-field">Ingredient / supply<input name="name" required maxLength={120} placeholder="e.g. Whole wheat bread" /></label>
      <label className="student-field">SKU (optional)<input name="sku" maxLength={50} /></label>
      <label className="student-field">Stock unit<input name="unit" required maxLength={24} placeholder="kg, litre, piece" /></label>
      <label className="student-field">Cost per unit<input name="costPerUnit" type="number" min="0" max="10000000" step="0.001" defaultValue="0" required /></label>
      <label className="student-field">Low-stock alert at<input name="reorderLevel" type="number" min="0" max="10000000" step="0.001" defaultValue="0" required /></label>
    </div>
    <p className="cafeteria-form__hint">New stock starts at zero. Use Stock movement to record an opening balance or purchase receipt.</p>
    <SubmitButton>Add stock item</SubmitButton>
  </form>;
}

export function CafeteriaStockMovementForm({ stockItems }: { stockItems: CafeteriaStockOption[] }) {
  const [state, action] = useActionState(recordCafeteriaStockMovement, undefined);
  return <form action={action} className="student-form cafeteria-form">
    <Feedback state={state} />
    <div className="student-form-grid">
      <OptionSelect label="Stock item" name="stockItemId" options={stockItems.map((item) => ({ id: item.id, name: `${item.name} (${item.unit})` }))} disabled={!stockItems.length} />
      <label className="student-field">Movement<select name="movementType" defaultValue="stock_in"><option value="stock_in">Purchase / opening stock</option><option value="stock_out">Stock issue</option><option value="waste">Waste / spoilage</option><option value="adjustment_add">Correction: increase</option><option value="adjustment_remove">Correction: decrease</option></select></label>
      <label className="student-field">Quantity<input name="quantity" type="number" min="0.001" max="10000000" step="0.001" required /></label>
      <label className="student-field">Unit cost (optional)<input name="unitCost" type="number" min="0" max="10000000" step="0.001" /></label>
      <label className="student-field">Supplier / reference<input name="reference" maxLength={100} /></label>
      <label className="student-field student-field-wide">Notes<textarea name="notes" rows={2} maxLength={500} /></label>
    </div>
    <SubmitButton disabled={!stockItems.length}>Record stock movement</SubmitButton>
  </form>;
}

export function CafeteriaRecipeIngredientForm({ menuItems, stockItems }: { menuItems: CafeteriaOption[]; stockItems: CafeteriaStockOption[] }) {
  const [state, action] = useActionState(saveCafeteriaRecipeIngredient, undefined);
  return <form action={action} className="student-form cafeteria-form">
    <Feedback state={state} />
    <div className="student-form-grid">
      <OptionSelect label="Menu item" name="menuItemId" options={menuItems} disabled={!menuItems.length} />
      <OptionSelect label="Ingredient" name="stockItemId" options={stockItems.map((item) => ({ id: item.id, name: `${item.name} (${item.unit})` }))} disabled={!stockItems.length} />
      <label className="student-field">Quantity per portion<input name="quantityPerPortion" type="number" min="0.001" max="100000" step="0.001" required /></label>
    </div>
    <p className="cafeteria-form__hint">Recipe quantities are deducted from live stock atomically when an order is accepted. Save one row per ingredient.</p>
    <SubmitButton disabled={!menuItems.length || !stockItems.length}>Save ingredient</SubmitButton>
  </form>;
}

function OrderLine({ menuItems, index }: { menuItems: CafeteriaOrderOption[]; index: number }) {
  return <div className="cafeteria-order-line">
    <label className="student-field">Menu item<select name="menuItemIds" required defaultValue=""><option value="">Select an available item</option>{menuItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.priceLabel}</option>)}</select></label>
    <label className="student-field">Portions<input name="quantities" type="number" min="1" max="100" defaultValue="1" required /></label>
    <span className="cafeteria-order-line__index">Item {index + 1}</span>
  </div>;
}

export function CafeteriaOrderForm({ menuItems }: { menuItems: CafeteriaOrderOption[] }) {
  const [state, action] = useActionState(createCafeteriaOrder, undefined);
  const [lineCount, setLineCount] = useState(1);
  return <form action={action} className="student-form cafeteria-form">
    <Feedback state={state} />
    <div className="student-form-grid">
      <label className="student-field student-field-wide">Customer / order label (optional)<input name="customerLabel" maxLength={120} placeholder="Counter order, staff name, or order note" /></label>
    </div>
    <div className="cafeteria-order-lines">
      {Array.from({ length: lineCount }, (_, index) => <OrderLine key={index} menuItems={menuItems} index={index} />)}
    </div>
    <button type="button" className="cafeteria-secondary-button" disabled={lineCount >= Math.min(30, menuItems.length)} onClick={() => setLineCount((count) => count + 1)}>+ Add another item</button>
    <div className="student-form-grid cafeteria-order-payment">
      <label className="student-field">Payment received now<input name="initialPayment" type="number" min="0" max="10000000" step="0.01" defaultValue="0" required /></label>
      <label className="student-field">Payment method<select name="paymentMethod" defaultValue="cash"><option value="cash">Cash</option><option value="card">Card</option><option value="transfer">Bank / mobile transfer</option><option value="other">Other</option></select></label>
      <label className="student-field">Payment reference (optional)<input name="paymentReference" maxLength={100} /></label>
    </div>
    <p className="cafeteria-form__hint">The order is accepted only for today’s scheduled menu. Recipe stock and any upfront payment are saved in one database transaction.</p>
    <SubmitButton disabled={!menuItems.length}>Create order</SubmitButton>
  </form>;
}

export function CafeteriaPaymentForm({ orderId, outstanding }: { orderId: string; outstanding: number }) {
  const [state, action] = useActionState(recordCafeteriaPayment, undefined);
  return <form action={action} className="cafeteria-inline-payment">
    <input type="hidden" name="orderId" value={orderId} />
    <label><span className="sr-only">Payment amount</span><input name="amount" type="number" min="0.01" max={outstanding.toFixed(2)} step="0.01" defaultValue={outstanding.toFixed(2)} required /></label>
    <label><span className="sr-only">Payment method</span><select name="paymentMethod" defaultValue="cash"><option value="cash">Cash</option><option value="card">Card</option><option value="transfer">Transfer</option><option value="other">Other</option></select></label>
    <label><span className="sr-only">Payment reference</span><input name="paymentReference" maxLength={100} placeholder="Reference (optional)" /></label>
    <SubmitButton>Receive</SubmitButton><Feedback state={state} />
  </form>;
}

export function CafeteriaOrderStatusForm({ orderId, status }: { orderId: string; status: string }) {
  const [state, action] = useActionState(advanceCafeteriaOrder, undefined);
  if (status === "served") return null;
  const nextStatus = status === "preparing" ? "ready" : "served";
  return <form action={action} className="cafeteria-order-status">
    <input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="status" value={nextStatus} />
    <SubmitButton>{nextStatus === "ready" ? "Mark ready" : "Mark served"}</SubmitButton><Feedback state={state} />
  </form>;
}

export function CafeteriaMenuItemStatusForm({ menuItemId, isActive }: { menuItemId: string; isActive: boolean }) {
  const [state, action] = useActionState(updateCafeteriaMenuItemStatus, undefined);
  return <form action={action} className="cafeteria-inline-status">
    <input type="hidden" name="menuItemId" value={menuItemId} /><input type="hidden" name="isActive" value={String(!isActive)} />
    <SubmitButton>{isActive ? "Pause item" : "Reactivate"}</SubmitButton><Feedback state={state} />
  </form>;
}

export function CafeteriaDailyMenuStatusForm({ dailyMenuId, isAvailable }: { dailyMenuId: string; isAvailable: boolean }) {
  const [state, action] = useActionState(updateCafeteriaDailyMenuStatus, undefined);
  return <form action={action} className="cafeteria-inline-status">
    <input type="hidden" name="dailyMenuId" value={dailyMenuId} /><input type="hidden" name="isAvailable" value={String(!isAvailable)} />
    <SubmitButton>{isAvailable ? "Pause" : "Reopen"}</SubmitButton><Feedback state={state} />
  </form>;
}
