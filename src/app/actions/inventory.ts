"use server";

import { revalidatePath } from "next/cache";
import { requireInventoryContext } from "@/lib/inventory/context";
import { categorySchema, itemSchema, stockTransactionSchema, supplierSchema, unitSchema, type InventoryFormState } from "@/lib/inventory/schemas";

function values(formData: FormData) { return Object.fromEntries(formData.entries()); }

export async function saveInventoryCategory(_: InventoryFormState | undefined, formData: FormData): Promise<InventoryFormState> {
  const parsed = categorySchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Category form invalid hai." };
  const { supabase, schoolId } = await requireInventoryContext("manage");
  const { error } = await supabase.from("inventory_categories").insert({ school_id: schoolId, name: parsed.data.name });
  if (error) return { error: error.code === "23505" ? "Category already exists." : "Category add nahi ho saka." };
  revalidatePath("/inventory"); return { success: "Category add ho gaya." };
}

export async function saveInventoryUnit(_: InventoryFormState | undefined, formData: FormData): Promise<InventoryFormState> {
  const parsed = unitSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Unit form invalid hai." };
  const { supabase, schoolId } = await requireInventoryContext("manage");
  const { error } = await supabase.from("inventory_units").insert({ school_id: schoolId, name: parsed.data.name, short_name: parsed.data.shortName });
  if (error) return { error: error.code === "23505" ? "Unit already exists." : "Unit add nahi ho saka." };
  revalidatePath("/inventory"); return { success: "Unit add ho gaya." };
}

export async function saveSupplier(_: InventoryFormState | undefined, formData: FormData): Promise<InventoryFormState> {
  const parsed = supplierSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Supplier form invalid hai." };
  const { supabase, schoolId } = await requireInventoryContext("manage");
  const { error } = await supabase.from("inventory_suppliers").insert({
    school_id: schoolId,
    name: parsed.data.name,
    contact_name: parsed.data.contactName || null,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    address: parsed.data.address || null,
  });
  if (error) return { error: error.code === "23505" ? "Supplier already exists." : "Supplier add nahi ho saka." };
  revalidatePath("/inventory"); return { success: "Supplier add ho gaya." };
}

export async function saveInventoryItem(_: InventoryFormState | undefined, formData: FormData): Promise<InventoryFormState> {
  const parsed = itemSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Item form invalid hai." };
  const { supabase, schoolId } = await requireInventoryContext("manage");
  const { error } = await supabase.from("inventory_items").insert({
    school_id: schoolId,
    category_id: parsed.data.categoryId,
    unit_id: parsed.data.unitId,
    supplier_id: parsed.data.supplierId || null,
    sku: parsed.data.sku,
    name: parsed.data.name,
    description: parsed.data.description || null,
    cost: parsed.data.cost,
    location: parsed.data.location || null,
    min_stock_level: parsed.data.minStockLevel,
    current_quantity: parsed.data.currentQuantity,
    status: parsed.data.status ?? "active",
  });
  if (error) return { error: error.code === "23505" ? "Item already exists." : "Item add nahi ho saka." };
  revalidatePath("/inventory"); return { success: "Item add ho gaya." };
}

export async function recordInventoryTransaction(_: InventoryFormState | undefined, formData: FormData): Promise<InventoryFormState> {
  const parsed = stockTransactionSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Stock transaction invalid hai." };
  const { supabase, schoolId } = await requireInventoryContext("manage");
  const { error } = await supabase.from("inventory_transactions").insert({
    school_id: schoolId,
    item_id: parsed.data.itemId,
    transaction_type: parsed.data.transactionType,
    quantity: parsed.data.quantity,
    unit_cost: parsed.data.unitCost === "" ? null : parsed.data.unitCost,
    reference: parsed.data.reference || null,
    notes: parsed.data.notes || null,
  });
  if (error) return { error: "Inventory transaction save nahi ho saka." };
  revalidatePath("/inventory"); return { success: "Stock movement save ho gaya." };
}
