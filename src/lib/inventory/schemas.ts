import { z } from "zod";

const databaseUuid = (message?: string) => z.string().regex(
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
  message,
);

export const categorySchema = z.object({ name: z.string().trim().min(1, "Category name required hai.").max(120) });
export const unitSchema = z.object({ name: z.string().trim().min(1, "Unit name required hai.").max(80), shortName: z.string().trim().min(1, "Short name required hai.").max(20) });
export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Supplier name required hai.").max(160),
  contactName: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email("Valid email required hai.").max(254).optional().or(z.literal("")),
  address: z.string().trim().max(1000).optional(),
});

export const itemSchema = z.object({
  categoryId: databaseUuid("Category required hai."),
  unitId: databaseUuid("Unit required hai."),
  supplierId: databaseUuid().optional().or(z.literal("")),
  sku: z.string().trim().min(1, "SKU required hai.").max(80),
  name: z.string().trim().min(1, "Item name required hai.").max(180),
  description: z.string().trim().max(2000).optional(),
  cost: z.coerce.number().finite().min(0).max(1000000000),
  location: z.string().trim().max(120).optional(),
  minStockLevel: z.coerce.number().int().min(0).max(100000000),
  currentQuantity: z.coerce.number().int().min(0).max(100000000),
  status: z.enum(["active", "inactive"]).optional(),
});

export const stockTransactionSchema = z.object({
  itemId: databaseUuid("Item required hai."),
  transactionType: z.enum(["stock_in", "stock_out", "adjustment", "return"]),
  quantity: z.coerce.number().int().min(-100000000).max(100000000).refine((value) => value !== 0, "Quantity zero nahi ho sakta."),
  unitCost: z.coerce.number().finite().min(0).max(1000000000).optional().or(z.literal("")),
  reference: z.string().trim().max(120).optional(),
  purchaseDepartment: z.string().trim().max(120).optional(),
  purchaseOrderNumber: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
}).refine((movement) => movement.transactionType === "adjustment" || movement.quantity > 0, {
  message: "Stock in, stock out, and return quantities must be positive.",
  path: ["quantity"],
}).refine((movement) => movement.transactionType === "stock_in" || (!movement.purchaseDepartment && !movement.purchaseOrderNumber), {
  message: "Department and PO details can only be added to stock-receive movements.",
  path: ["purchaseOrderNumber"],
});

export type InventoryFormState = { error?: string; success?: string };
