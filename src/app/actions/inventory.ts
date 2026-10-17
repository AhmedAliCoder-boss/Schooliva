"use server";

import { revalidatePath } from "next/cache";
import { requireInventoryContext } from "@/lib/inventory/context";
import { categorySchema, itemSchema, stockTransactionSchema, supplierSchema, unitSchema, type InventoryFormState } from "@/lib/inventory/schemas";

function values(formData: FormData) { return Object.fromEntries(formData.entries()); }

export async function saveInventoryCategory(_: InventoryFormState | undefined, formData: FormData): Promise<InventoryFormState> {
  const parsed = categorySchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Category form is invalid." };
  const { supabase, schoolId } = await requireInventoryContext("manage");
  const { error } = await supabase.from("inventory_categories").insert({ school_id: schoolId, name: parsed.data.name });
  if (error) {
    console.error("Inventory category could not be created.", error);
    return { error: error.code === "23505" ? "Category already exists." : "Category could not be added." };
  }
  revalidatePath("/inventory"); return { success: "Category added." };
}

export async function saveInventoryUnit(_: InventoryFormState | undefined, formData: FormData): Promise<InventoryFormState> {
  const parsed = unitSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Unit form is invalid." };
  const { supabase, schoolId } = await requireInventoryContext("manage");
  const { error } = await supabase.from("inventory_units").insert({ school_id: schoolId, name: parsed.data.name, short_name: parsed.data.shortName });
  if (error) {
    console.error("Inventory unit could not be created.", error);
    return { error: error.code === "23505" ? "Unit already exists." : "Unit could not be added." };
  }
  revalidatePath("/inventory"); return { success: "Unit added." };
}

export async function saveSupplier(_: InventoryFormState | undefined, formData: FormData): Promise<InventoryFormState> {
  const parsed = supplierSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Supplier form is invalid." };
  const { supabase, schoolId } = await requireInventoryContext("manage");
  const { error } = await supabase.from("inventory_suppliers").insert({
    school_id: schoolId,
    name: parsed.data.name,
    contact_name: parsed.data.contactName || null,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    address: parsed.data.address || null,
  });
  if (error) {
    console.error("Inventory supplier could not be created.", error);
    return { error: error.code === "23505" ? "Supplier already exists." : "Supplier could not be added." };
  }
  revalidatePath("/inventory"); return { success: "Supplier added." };
}

export async function saveInventoryItem(_: InventoryFormState | undefined, formData: FormData): Promise<InventoryFormState> {
  const parsed = itemSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Item form is invalid." };
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
  if (error) {
    console.error("Inventory item could not be created.", error);
    return { error: error.code === "23505" ? "An item with this SKU or name already exists." : "Item could not be added." };
  }
  revalidatePath("/inventory"); return { success: "Item added." };
}

export async function recordInventoryTransaction(_: InventoryFormState | undefined, formData: FormData): Promise<InventoryFormState> {
  const parsed = stockTransactionSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Stock transaction is invalid." };
  const { supabase, schoolId, user } = await requireInventoryContext("manage");
  const paymentBillValue = formData.get("paymentBill");
  const paymentBill = paymentBillValue instanceof File && paymentBillValue.size > 0 ? paymentBillValue : null;
  if (paymentBill && parsed.data.transactionType !== "stock_in") {
    return { error: "Payment bills can only be attached to stock-receive movements." };
  }
  if (paymentBill && paymentBill.size > 5 * 1024 * 1024) {
    return { error: "Payment bill must be smaller than 5 MB." };
  }
  const extensionByType: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
  };
  const extension = paymentBill ? extensionByType[paymentBill.type] : undefined;
  if (paymentBill && !extension) {
    return { error: "Payment bill must be a PDF, JPG, or PNG file." };
  }
  if (paymentBill) {
    const signature = new Uint8Array(await paymentBill.slice(0, 8).arrayBuffer());
    const isPdf = paymentBill.type === "application/pdf" && new TextDecoder().decode(signature.slice(0, 5)) === "%PDF-";
    const isJpeg = paymentBill.type === "image/jpeg" && signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
    const isPng = paymentBill.type === "image/png" && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => signature[index] === byte);
    if (!isPdf && !isJpeg && !isPng) {
      return { error: "Payment bill content does not match its selected file type." };
    }
  }
  const { data: item, error: itemError } = await supabase.from("inventory_items")
    .select("id,name,status")
    .eq("id", parsed.data.itemId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (itemError) {
    console.error("Inventory item for stock movement could not be verified.", itemError);
    return { error: "Inventory item could not be verified." };
  }
  if (!item) return { error: "Selected item was not found in this school's inventory." };
  if (item.status !== "active") return { error: "Stock movements cannot be recorded for inactive items." };
  if (parsed.data.transactionType === "stock_out" && parsed.data.quantity <= 0) {
    return { error: "Stock out quantity must be a positive number." };
  }
  const billStoragePath = paymentBill && extension
    ? `${schoolId}/${user.id}/${crypto.randomUUID()}.${extension}`
    : null;
  if (paymentBill && billStoragePath) {
    const { error: uploadError } = await supabase.storage.from("inventory-purchase-bills").upload(billStoragePath, paymentBill, {
      contentType: paymentBill.type,
      upsert: false,
    });
    if (uploadError) {
      console.error("Inventory payment bill could not be uploaded.", uploadError);
      return { error: "Payment bill upload failed. Check the private inventory-purchase-bills storage bucket and try again." };
    }
  }
  const { error } = await supabase.from("inventory_transactions").insert({
    school_id: schoolId,
    created_by: user.id,
    item_id: parsed.data.itemId,
    transaction_type: parsed.data.transactionType,
    quantity: parsed.data.quantity,
    unit_cost: parsed.data.unitCost === "" ? null : parsed.data.unitCost,
    reference: parsed.data.reference || null,
    purchase_department: parsed.data.purchaseDepartment || null,
    purchase_order_number: parsed.data.purchaseOrderNumber || null,
    bill_storage_path: billStoragePath,
    bill_file_name: paymentBill?.name.slice(0, 255) || null,
    notes: parsed.data.notes || null,
  });
  if (error) {
    console.error("Inventory stock movement could not be recorded.", error);
    const { error: cleanupError } = billStoragePath
      ? await supabase.storage.from("inventory-purchase-bills").remove([billStoragePath])
      : { error: null };
    if (cleanupError) {
      console.error("Unlinked inventory payment bill could not be removed.", cleanupError);
      return { error: "Stock movement failed, and the uploaded bill could not be cleaned up. Contact an administrator." };
    }
    if (error.message.includes("Stock out exceeds available quantity")) return { error: "Stock out exceeds the available quantity." };
    if (error.message.includes("Inventory item does not belong")) return { error: "Selected item was not found in this school's inventory." };
    return { error: "Inventory transaction could not be saved." };
  }
  revalidatePath("/inventory");
  return { success: `Stock movement recorded and on-hand quantity updated${billStoragePath ? " with payment bill attached." : "."}` };
}
