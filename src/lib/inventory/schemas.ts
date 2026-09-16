import { z } from "zod";

export const categorySchema = z.object({ name: z.string().trim().min(1, "Category name required hai.") });
export const unitSchema = z.object({ name: z.string().trim().min(1, "Unit name required hai."), shortName: z.string().trim().min(1, "Short name required hai.") });
export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Supplier name required hai."),
  contactName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Valid email required hai.").optional().or(z.literal("")),
  address: z.string().trim().optional(),
});

export const itemSchema = z.object({
  categoryId: z.string().uuid("Category required hai."),
  unitId: z.string().uuid("Unit required hai."),
  supplierId: z.string().uuid().optional().or(z.literal("")),
  sku: z.string().trim().min(1, "SKU required hai."),
  name: z.string().trim().min(1, "Item name required hai."),
  description: z.string().trim().optional(),
  cost: z.coerce.number().min(0),
  location: z.string().trim().optional(),
  minStockLevel: z.coerce.number().int().min(0),
  currentQuantity: z.coerce.number().int().min(0),
  status: z.enum(["active", "inactive"]).optional(),
});

export const stockTransactionSchema = z.object({
  itemId: z.string().uuid("Item required hai."),
  transactionType: z.enum(["stock_in", "stock_out", "adjustment", "return"]),
  quantity: z.coerce.number().int().refine((value) => value !== 0, "Quantity zero nahi ho sakta."),
  unitCost: z.coerce.number().min(0).optional().or(z.literal("")),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type InventoryFormState = { error?: string; success?: string };
