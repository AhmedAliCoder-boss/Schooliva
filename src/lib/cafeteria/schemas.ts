import { z } from "zod";

const databaseUuid = (message = "Invalid identifier.") => z.string().regex(
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
  message,
);

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid date.");

export const cafeteriaMenuItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(["breakfast", "lunch", "snack", "beverage", "other"]),
  description: z.string().trim().max(500),
  price: z.coerce.number().finite().min(0).max(1000000),
  allergens: z.string().trim().max(300),
});

export const cafeteriaDailyMenuSchema = z.object({
  menuItemId: databaseUuid(),
  serviceDate: dateSchema,
  mealPeriod: z.enum(["breakfast", "lunch", "snack"]),
  quantityLimit: z.union([z.literal(""), z.coerce.number().int().min(1).max(10000)]),
});

export const cafeteriaMonthlyMenuSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a valid month."),
  entries: z.array(z.object({
    menuItemId: databaseUuid(),
    serviceDate: dateSchema,
    mealPeriod: z.enum(["breakfast", "lunch", "snack"]),
  })).min(1, "Choose at least one menu item for the month.").max(93),
}).superRefine((plan, context) => {
  const slots = new Set<string>();
  for (const [index, entry] of plan.entries.entries()) {
    if (!entry.serviceDate.startsWith(`${plan.month}-`)) {
      context.addIssue({ code: "custom", path: ["entries", index, "serviceDate"], message: "Every menu date must be in the selected month." });
    }
    const slot = `${entry.serviceDate}:${entry.mealPeriod}`;
    if (slots.has(slot)) {
      context.addIssue({ code: "custom", path: ["entries", index, "mealPeriod"], message: "Only one menu item per date and meal can be added from the monthly planner." });
    }
    slots.add(slot);
  }
});

export const cafeteriaStockItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().max(50),
  unit: z.string().trim().min(1).max(24),
  costPerUnit: z.coerce.number().finite().min(0).max(10000000),
  reorderLevel: z.coerce.number().finite().min(0).max(10000000),
});

export const cafeteriaStockMovementSchema = z.object({
  stockItemId: databaseUuid(),
  movementType: z.enum(["stock_in", "stock_out", "waste", "adjustment_add", "adjustment_remove"]),
  quantity: z.coerce.number().finite().positive().max(10000000),
  unitCost: z.union([z.literal(""), z.coerce.number().finite().min(0).max(10000000)]),
  reference: z.string().trim().max(100),
  notes: z.string().trim().max(500),
});

export const cafeteriaRecipeIngredientSchema = z.object({
  menuItemId: databaseUuid(),
  stockItemId: databaseUuid(),
  quantityPerPortion: z.coerce.number().finite().positive().max(100000),
});

export const cafeteriaOrderSchema = z.object({
  customerLabel: z.string().trim().max(120),
  menuItemIds: z.array(databaseUuid()).min(1).max(30),
  quantities: z.array(z.coerce.number().int().min(1).max(100)).min(1).max(30),
  initialPayment: z.coerce.number().finite().min(0).max(10000000),
  paymentMethod: z.enum(["cash", "card", "transfer", "other"]),
  paymentReference: z.string().trim().max(100),
}).refine((order) => order.menuItemIds.length === order.quantities.length, {
  message: "Each cafeteria item needs a quantity.",
  path: ["quantities"],
}).refine((order) => new Set(order.menuItemIds).size === order.menuItemIds.length, {
  message: "Add each menu item only once.",
  path: ["menuItemIds"],
});

export const cafeteriaPaymentSchema = z.object({
  orderId: databaseUuid(),
  amount: z.coerce.number().finite().positive().max(10000000),
  paymentMethod: z.enum(["cash", "card", "transfer", "other"]),
  paymentReference: z.string().trim().max(100),
});

export const cafeteriaOrderStatusSchema = z.object({
  orderId: databaseUuid(),
  status: z.enum(["ready", "served"]),
});

export type CafeteriaFormState = { error?: string; success?: string };
export type CafeteriaServicePeriod = "breakfast" | "lunch" | "snack";
