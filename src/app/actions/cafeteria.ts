"use server";

import { revalidatePath } from "next/cache";

import { requireCafeteriaContext } from "@/lib/cafeteria/context";
import {
  cafeteriaDailyMenuSchema,
  cafeteriaMonthlyMenuSchema,
  cafeteriaMenuItemSchema,
  cafeteriaOrderSchema,
  cafeteriaOrderStatusSchema,
  cafeteriaPaymentSchema,
  cafeteriaRecipeIngredientSchema,
  cafeteriaStockItemSchema,
  cafeteriaStockMovementSchema,
  type CafeteriaFormState,
} from "@/lib/cafeteria/schemas";

function formValues(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function reportActionError(action: string, error: unknown, fallback: string): CafeteriaFormState {
  console.error(`Cafeteria ${action} failed.`, error);
  return { error: fallback };
}

function revalidateCafeteria() {
  revalidatePath("/cafeteria");
}

export async function saveCafeteriaMenuItem(_: CafeteriaFormState | undefined, formData: FormData): Promise<CafeteriaFormState> {
  const parsed = cafeteriaMenuItemSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Menu item details are invalid." };
  const { supabase, schoolId, user } = await requireCafeteriaContext("manage");
  const { error } = await supabase.from("cafeteria_menu_items").insert({
    school_id: schoolId,
    name: parsed.data.name,
    category: parsed.data.category,
    description: parsed.data.description || null,
    price: parsed.data.price,
    allergens: parsed.data.allergens || null,
    created_by: user.id,
  });
  if (error) return reportActionError("menu item creation", error, error.code === "23505" ? "A cafeteria item with this name already exists." : "Menu item could not be added.");
  revalidateCafeteria();
  return { success: "Menu item added to the cafeteria catalog." };
}

export async function saveCafeteriaDailyMenu(_: CafeteriaFormState | undefined, formData: FormData): Promise<CafeteriaFormState> {
  const parsed = cafeteriaDailyMenuSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Daily menu details are invalid." };
  const { supabase, schoolId, user } = await requireCafeteriaContext("manage");
  const { data: item, error: itemError } = await supabase.from("cafeteria_menu_items")
    .select("id,is_active")
    .eq("id", parsed.data.menuItemId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (itemError) return reportActionError("daily menu item check", itemError, "The selected menu item could not be verified.");
  if (!item?.is_active) return { error: "Choose an active cafeteria menu item." };
  const { error } = await supabase.from("cafeteria_daily_menus").upsert({
    school_id: schoolId,
    menu_item_id: parsed.data.menuItemId,
    service_date: parsed.data.serviceDate,
    meal_period: parsed.data.mealPeriod,
    quantity_limit: parsed.data.quantityLimit === "" ? null : parsed.data.quantityLimit,
    is_available: true,
    created_by: user.id,
  }, { onConflict: "school_id,menu_item_id,service_date,meal_period" });
  if (error) return reportActionError("daily menu scheduling", error, "Daily menu could not be scheduled.");
  revalidateCafeteria();
  return { success: "Item scheduled on the selected daily menu." };
}

export async function saveCafeteriaMonthlyMenu(_: CafeteriaFormState | undefined, formData: FormData): Promise<CafeteriaFormState> {
  const rawEntries = formData.get("entries");
  if (typeof rawEntries !== "string") return { error: "Monthly menu entries are missing." };
  let entries: unknown;
  try {
    entries = JSON.parse(rawEntries);
  } catch {
    return { error: "Monthly menu entries could not be read." };
  }
  const parsed = cafeteriaMonthlyMenuSchema.safeParse({
    month: formData.get("month"),
    entries,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Monthly menu details are invalid." };

  const { supabase, schoolId, user } = await requireCafeteriaContext("manage");
  const menuItemIds = [...new Set(parsed.data.entries.map((entry) => entry.menuItemId))];
  const { data: activeItems, error: itemError } = await supabase.from("cafeteria_menu_items")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .in("id", menuItemIds);
  if (itemError) return reportActionError("monthly menu item check", itemError, "Selected menu items could not be verified.");
  if ((activeItems ?? []).length !== menuItemIds.length) return { error: "Choose active cafeteria menu items from this school." };

  const { error } = await supabase.from("cafeteria_daily_menus").upsert(
    parsed.data.entries.map((entry) => ({
      school_id: schoolId,
      menu_item_id: entry.menuItemId,
      service_date: entry.serviceDate,
      meal_period: entry.mealPeriod,
      quantity_limit: null,
      is_available: true,
      created_by: user.id,
    })),
    { onConflict: "school_id,menu_item_id,service_date,meal_period" },
  );
  if (error) return reportActionError("monthly menu scheduling", error, "Monthly menu could not be saved.");
  revalidateCafeteria();
  return { success: `${parsed.data.entries.length} menu slot${parsed.data.entries.length === 1 ? "" : "s"} scheduled for ${parsed.data.month}.` };
}

export async function saveCafeteriaStockItem(_: CafeteriaFormState | undefined, formData: FormData): Promise<CafeteriaFormState> {
  const parsed = cafeteriaStockItemSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Stock item details are invalid." };
  const { supabase, schoolId, user } = await requireCafeteriaContext("manage");
  const { error } = await supabase.from("cafeteria_stock_items").insert({
    school_id: schoolId,
    name: parsed.data.name,
    sku: parsed.data.sku || null,
    unit: parsed.data.unit,
    cost_per_unit: parsed.data.costPerUnit,
    reorder_level: parsed.data.reorderLevel,
    created_by: user.id,
  });
  if (error) return reportActionError("stock item creation", error, error.code === "23505" ? "A stock item with this name or SKU already exists." : "Stock item could not be added.");
  revalidateCafeteria();
  return { success: "Ingredient or supply added. Record its opening quantity in Stock movement." };
}

export async function recordCafeteriaStockMovement(_: CafeteriaFormState | undefined, formData: FormData): Promise<CafeteriaFormState> {
  const parsed = cafeteriaStockMovementSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Stock movement details are invalid." };
  const { supabase, schoolId, user } = await requireCafeteriaContext("manage");
  const { data: item, error: itemError } = await supabase.from("cafeteria_stock_items")
    .select("id,is_active")
    .eq("id", parsed.data.stockItemId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (itemError) return reportActionError("stock item check", itemError, "The selected stock item could not be verified.");
  if (!item?.is_active) return { error: "Choose an active cafeteria stock item." };
  const { error } = await supabase.from("cafeteria_stock_transactions").insert({
    school_id: schoolId,
    stock_item_id: parsed.data.stockItemId,
    transaction_type: parsed.data.movementType,
    quantity: parsed.data.quantity,
    unit_cost: parsed.data.unitCost === "" ? null : parsed.data.unitCost,
    reference: parsed.data.reference || null,
    notes: parsed.data.notes || null,
    created_by: user.id,
  });
  if (error) return reportActionError("stock movement", error, "Stock movement could not be recorded. Check that sufficient stock is available.");
  revalidateCafeteria();
  return { success: "Stock movement recorded and on-hand quantity updated." };
}

export async function saveCafeteriaRecipeIngredient(_: CafeteriaFormState | undefined, formData: FormData): Promise<CafeteriaFormState> {
  const parsed = cafeteriaRecipeIngredientSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Recipe ingredient details are invalid." };
  const { supabase, schoolId, user } = await requireCafeteriaContext("manage");
  const [{ data: menuItem, error: menuError }, { data: stockItem, error: stockError }] = await Promise.all([
    supabase.from("cafeteria_menu_items").select("id,is_active").eq("id", parsed.data.menuItemId).eq("school_id", schoolId).maybeSingle(),
    supabase.from("cafeteria_stock_items").select("id,is_active").eq("id", parsed.data.stockItemId).eq("school_id", schoolId).maybeSingle(),
  ]);
  if (menuError || stockError) return reportActionError("recipe reference check", { menuError, stockError }, "The selected menu item and stock item could not be verified.");
  if (!menuItem?.is_active || !stockItem?.is_active) return { error: "Choose active menu and stock items." };
  const { error } = await supabase.from("cafeteria_recipe_ingredients").upsert({
    school_id: schoolId,
    menu_item_id: parsed.data.menuItemId,
    stock_item_id: parsed.data.stockItemId,
    quantity_per_portion: parsed.data.quantityPerPortion,
    created_by: user.id,
  }, { onConflict: "school_id,menu_item_id,stock_item_id" });
  if (error) return reportActionError("recipe ingredient save", error, "Recipe ingredient could not be saved.");
  revalidateCafeteria();
  return { success: "Recipe ingredient saved. Sales will now deduct its per-portion stock." };
}

export async function createCafeteriaOrder(_: CafeteriaFormState | undefined, formData: FormData): Promise<CafeteriaFormState> {
  const parsed = cafeteriaOrderSchema.safeParse({
    customerLabel: formData.get("customerLabel") ?? "",
    menuItemIds: formData.getAll("menuItemIds"),
    quantities: formData.getAll("quantities"),
    initialPayment: formData.get("initialPayment") ?? "0",
    paymentMethod: formData.get("paymentMethod") ?? "cash",
    paymentReference: formData.get("paymentReference") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Cafeteria order details are invalid." };
  const { supabase, schoolId } = await requireCafeteriaContext("manage");
  const lines = parsed.data.menuItemIds.map((menuItemId, index) => ({ menuItemId, quantity: parsed.data.quantities[index] }));
  const { error } = await supabase.rpc("create_cafeteria_order", {
    target_school_id: schoolId,
    target_customer_label: parsed.data.customerLabel,
    target_order_lines: lines,
    target_initial_payment: parsed.data.initialPayment,
    target_payment_method: parsed.data.paymentMethod,
    target_payment_reference: parsed.data.paymentReference,
  });
  if (error) return reportActionError("order creation", error, error.message.includes("Cafeteria") || error.message.includes("The selected") || error.message.includes("Add recipe") || error.message.includes("Initial payment")
    ? error.message
    : "Cafeteria order could not be created.");
  revalidateCafeteria();
  return { success: "Order created, recipe stock deducted, and payment recorded if provided." };
}

export async function recordCafeteriaPayment(_: CafeteriaFormState | undefined, formData: FormData): Promise<CafeteriaFormState> {
  const parsed = cafeteriaPaymentSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Payment details are invalid." };
  const { supabase, schoolId } = await requireCafeteriaContext("manage");
  const { error } = await supabase.rpc("record_cafeteria_payment", {
    target_school_id: schoolId,
    target_order_id: parsed.data.orderId,
    target_amount: parsed.data.amount,
    target_payment_method: parsed.data.paymentMethod,
    target_payment_reference: parsed.data.paymentReference,
  });
  if (error) return reportActionError("payment collection", error, error.message.includes("Cafeteria") || error.message.includes("exceeds")
    ? error.message
    : "Cafeteria payment could not be recorded.");
  revalidateCafeteria();
  return { success: "Payment recorded against the cafeteria order." };
}

export async function advanceCafeteriaOrder(_: CafeteriaFormState | undefined, formData: FormData): Promise<CafeteriaFormState> {
  const parsed = cafeteriaOrderStatusSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Order status is invalid." };
  const { supabase, schoolId } = await requireCafeteriaContext("manage");
  const { error } = await supabase.rpc("set_cafeteria_order_status", {
    target_school_id: schoolId,
    target_order_id: parsed.data.orderId,
    target_status: parsed.data.status,
  });
  if (error) return reportActionError("order status change", error, error.message.includes("Cafeteria order")
    ? error.message
    : "Cafeteria order status could not be updated.");
  revalidateCafeteria();
  return { success: `Order marked ${parsed.data.status}.` };
}

export async function updateCafeteriaMenuItemStatus(_: CafeteriaFormState | undefined, formData: FormData): Promise<CafeteriaFormState> {
  const itemId = formData.get("menuItemId");
  const isActive = formData.get("isActive") === "true";
  if (typeof itemId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(itemId)) {
    return { error: "Select a valid cafeteria menu item." };
  }
  const { supabase, schoolId } = await requireCafeteriaContext("manage");
  const { data, error } = await supabase.from("cafeteria_menu_items")
    .update({ is_active: isActive })
    .eq("id", itemId)
    .eq("school_id", schoolId)
    .select("id")
    .maybeSingle();
  if (error) return reportActionError("menu item status update", error, "Menu item status could not be updated.");
  if (!data) return { error: "Menu item was not found in this school's cafeteria." };
  revalidateCafeteria();
  return { success: `Menu item marked ${isActive ? "active" : "inactive"}.` };
}

export async function updateCafeteriaDailyMenuStatus(_: CafeteriaFormState | undefined, formData: FormData): Promise<CafeteriaFormState> {
  const menuId = formData.get("dailyMenuId");
  const isAvailable = formData.get("isAvailable") === "true";
  if (typeof menuId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(menuId)) {
    return { error: "Select a valid daily menu entry." };
  }
  const { supabase, schoolId } = await requireCafeteriaContext("manage");
  const { data, error } = await supabase.from("cafeteria_daily_menus")
    .update({ is_available: isAvailable })
    .eq("id", menuId)
    .eq("school_id", schoolId)
    .select("id")
    .maybeSingle();
  if (error) return reportActionError("daily menu availability update", error, "Daily menu availability could not be updated.");
  if (!data) return { error: "Daily menu entry was not found in this school." };
  revalidateCafeteria();
  return { success: `Daily menu item marked ${isAvailable ? "available" : "unavailable"}.` };
}
