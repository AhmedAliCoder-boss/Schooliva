"use client";

import { useActionState, useMemo, useState } from "react";

import { recordInventoryTransaction, saveInventoryCategory, saveInventoryItem, saveInventoryUnit, saveSupplier } from "@/app/actions/inventory";
import { SubmitButton } from "@/components/auth/submit-button";
import type { InventoryFormState } from "@/lib/inventory/schemas";

type Option = { id: string; name: string };
type InventoryItemOption = Option & { currentQuantity: number; unit: string };

function Feedback({ state }: { state: InventoryFormState | undefined }) {
  return <>{state?.error && <p className="student-error" role="alert">{state.error}</p>}{state?.success && <p className="student-success" role="status">{state.success}</p>}</>;
}

function Select({ label, name, options, required = true }: { label: string; name: string; options: Option[]; required?: boolean }) {
  return <label className="student-field">{label}<select name={name} required={required}><option value="">{required ? `Select ${label.toLowerCase()}` : `No ${label.toLowerCase()}`}</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}

export function CategoryForm() {
  const [state, action] = useActionState(saveInventoryCategory, undefined);
  return <form action={action} className="student-form inventory-form"><Feedback state={state} /><div className="student-form-grid"><label className="student-field">Category name<input name="name" required maxLength={120} placeholder="e.g. Stationery" /></label></div><SubmitButton>Add category</SubmitButton></form>;
}

export function UnitForm() {
  const [state, action] = useActionState(saveInventoryUnit, undefined);
  return <form action={action} className="student-form inventory-form"><Feedback state={state} /><div className="student-form-grid"><label className="student-field">Unit name<input name="name" required maxLength={80} placeholder="e.g. Box" /></label><label className="student-field">Short name<input name="shortName" required maxLength={20} placeholder="e.g. bx" /></label></div><SubmitButton>Add unit</SubmitButton></form>;
}

export function SupplierForm() {
  const [state, action] = useActionState(saveSupplier, undefined);
  return <form action={action} className="student-form inventory-form"><Feedback state={state} /><div className="student-form-grid"><label className="student-field">Supplier name<input name="name" required maxLength={160} /></label><label className="student-field">Contact person<input name="contactName" maxLength={160} /></label><label className="student-field">Phone<input name="phone" maxLength={40} /></label><label className="student-field">Email<input name="email" type="email" maxLength={254} /></label><label className="student-field student-field-wide">Address<textarea name="address" rows={3} maxLength={1000} /></label></div><SubmitButton>Add supplier</SubmitButton></form>;
}

export function ItemForm({ categories, units, suppliers }: { categories: Option[]; units: Option[]; suppliers: Option[] }) {
  const [state, action] = useActionState(saveInventoryItem, undefined);
  return <form action={action} className="student-form inventory-form"><Feedback state={state} /><div className="student-form-grid">
    <Select label="Category" name="categoryId" options={categories} />
    <Select label="Unit" name="unitId" options={units} />
    <Select label="Supplier (optional)" name="supplierId" options={suppliers} required={false} />
    <label className="student-field">SKU<input name="sku" required maxLength={80} /></label>
    <label className="student-field">Item name<input name="name" required maxLength={180} /></label>
    <label className="student-field">Unit cost<input name="cost" type="number" min="0" step="0.01" required /></label>
    <label className="student-field">Storage location<input name="location" maxLength={120} /></label>
    <label className="student-field">Reorder threshold<input name="minStockLevel" type="number" min="0" required /></label>
    <label className="student-field">Opening quantity<input name="currentQuantity" type="number" min="0" defaultValue="0" required /><small>Opening quantity is the initial baseline for this item.</small></label>
    <label className="student-field">Status<select name="status"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
    <label className="student-field student-field-wide">Description<textarea name="description" rows={3} maxLength={2000} /></label>
  </div><SubmitButton>Add item</SubmitButton></form>;
}

export function StockTransactionForm({ items }: { items: InventoryItemOption[] }) {
  const [state, action] = useActionState(recordInventoryTransaction, undefined);
  const [itemId, setItemId] = useState("");
  const [transactionType, setTransactionType] = useState<"stock_in" | "stock_out" | "adjustment" | "return">("stock_in");
  const [quantity, setQuantity] = useState("1");
  const selectedItem = items.find((item) => item.id === itemId);
  const adjustedQuantity = useMemo(() => {
    const amount = Number(quantity) || 0;
    if (transactionType === "stock_in" || transactionType === "return") return amount;
    return -amount;
  }, [quantity, transactionType]);
  const projectedQuantity = (selectedItem?.currentQuantity ?? 0) + adjustedQuantity;

  return <form action={action} className="student-form inventory-form"><Feedback state={state} /><div className="student-form-grid">
    <label className="student-field">Inventory item<select name="itemId" value={itemId} onChange={(event) => setItemId(event.target.value)} required><option value="">Select an active item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.currentQuantity} {item.unit} on hand</option>)}</select></label>
    <label className="student-field">Movement type<select name="transactionType" value={transactionType} onChange={(event) => {
      if (event.target.value === "stock_in" || event.target.value === "stock_out" || event.target.value === "adjustment" || event.target.value === "return") setTransactionType(event.target.value);
    }} required><option value="stock_in">Receive stock</option><option value="stock_out">Issue / consume stock</option><option value="return">Return to stock</option><option value="adjustment">Adjustment (signed)</option></select></label>
    <label className="student-field">{transactionType === "adjustment" ? "Adjustment quantity (+ reduce / − increase)" : "Quantity"}<input name="quantity" type="number" min={transactionType === "adjustment" ? undefined : "1"} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
    <label className="student-field">Unit cost<input name="unitCost" type="number" min="0" step="0.01" /></label>
    {transactionType === "stock_in" ? <>
      <label className="student-field">Stores department (optional)<input name="purchaseDepartment" maxLength={120} placeholder="e.g. Science department" /></label>
      <label className="student-field">Purchase order number (optional)<input name="purchaseOrderNumber" maxLength={120} placeholder="e.g. PO-2026-014" /></label>
      <label className="student-field">Payment bill (optional)<input name="paymentBill" type="file" accept="application/pdf,image/jpeg,image/png" /><small>PDF, JPG, or PNG up to 5 MB.</small></label>
    </> : null}
    <label className="student-field">Reference<input name="reference" maxLength={120} placeholder="Issue slip, adjustment reference…" /></label>
    <label className="student-field student-field-wide">Movement notes<textarea name="notes" rows={3} maxLength={1000} placeholder="Reason, recipient, or delivery notes" /></label>
  </div>
  {selectedItem && <div className={`inventory-movement-preview${projectedQuantity < 0 ? " inventory-movement-preview--invalid" : ""}`}><span>On hand <strong>{selectedItem.currentQuantity} {selectedItem.unit}</strong></span><i>→</i><span>After movement <strong>{projectedQuantity} {selectedItem.unit}</strong></span>{projectedQuantity < 0 && <small>This would make stock negative; the server will reject it.</small>}</div>}
  <p className="inventory-form__hint">Every movement is recorded in the ledger. Stock-out quantities cannot exceed on-hand stock.</p>
  <SubmitButton disabled={!items.length || (Boolean(selectedItem) && projectedQuantity < 0)}>Record movement</SubmitButton>
  </form>;
}
