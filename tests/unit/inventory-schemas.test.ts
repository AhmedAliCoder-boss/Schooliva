import { describe, expect, it } from "vitest";

import { categorySchema, itemSchema, stockTransactionSchema, supplierSchema, unitSchema } from "../../src/lib/inventory/schemas";

const id = "d9428888-122b-4f71-bdf3-57db2058e358";
const postgresUuidWithoutRfcVersion = "00000000-0000-0000-0000-000000000000";
const item = {
  categoryId: id,
  unitId: id,
  supplierId: "",
  sku: "PEN-BLU",
  name: "Blue pen",
  cost: "12.50",
  minStockLevel: "10",
  currentQuantity: "20",
};

describe("inventory workflow validation", () => {
  it("validates category, unit, and supplier details", () => {
    expect(categorySchema.safeParse({ name: "  Stationery  " }).success).toBe(true);
    expect(categorySchema.safeParse({ name: " " }).success).toBe(false);
    expect(unitSchema.safeParse({ name: "Packet", shortName: "pkt" }).success).toBe(true);
    expect(unitSchema.safeParse({ name: "Packet", shortName: "" }).success).toBe(false);
    expect(supplierSchema.safeParse({ name: "School Supplies Co", email: "orders@example.com" }).success).toBe(true);
    expect(supplierSchema.safeParse({ name: "School Supplies Co", email: "not-an-email" }).success).toBe(false);
  });

  it("allows an optional supplier while bounding item data", () => {
    expect(itemSchema.safeParse(item).success).toBe(true);
    expect(itemSchema.safeParse({ ...item, categoryId: postgresUuidWithoutRfcVersion, unitId: postgresUuidWithoutRfcVersion, supplierId: postgresUuidWithoutRfcVersion }).success).toBe(true);
    expect(itemSchema.safeParse({ ...item, categoryId: "invalid" }).success).toBe(false);
    expect(itemSchema.safeParse({ ...item, currentQuantity: "-1" }).success).toBe(false);
    expect(itemSchema.safeParse({ ...item, cost: "Infinity" }).success).toBe(false);
  });

  it("requires positive ordinary movements and signed non-zero adjustments", () => {
    const movement = { itemId: id, transactionType: "stock_in", quantity: "5" };
    expect(stockTransactionSchema.safeParse(movement).success).toBe(true);
    expect(stockTransactionSchema.safeParse({ ...movement, itemId: postgresUuidWithoutRfcVersion }).success).toBe(true);
    expect(stockTransactionSchema.safeParse({ ...movement, transactionType: "stock_out", quantity: "-5" }).success).toBe(false);
    expect(stockTransactionSchema.safeParse({ ...movement, transactionType: "adjustment", quantity: "-5" }).success).toBe(true);
    expect(stockTransactionSchema.safeParse({ ...movement, transactionType: "adjustment", quantity: "0" }).success).toBe(false);
    expect(stockTransactionSchema.safeParse({ ...movement, quantity: "1.5" }).success).toBe(false);
    expect(stockTransactionSchema.safeParse({ ...movement, quantity: "100000001" }).success).toBe(false);
  });

  it("accepts bounded purchase department and PO details only for stock receipt", () => {
    expect(stockTransactionSchema.safeParse({
      itemId: id,
      transactionType: "stock_in",
      quantity: "5",
      purchaseDepartment: "Science",
      purchaseOrderNumber: "PO-2026-014",
    }).success).toBe(true);
    expect(stockTransactionSchema.safeParse({
      itemId: id,
      transactionType: "stock_out",
      quantity: "5",
      purchaseDepartment: "Science",
    }).success).toBe(false);
    expect(stockTransactionSchema.safeParse({
      itemId: id,
      transactionType: "stock_in",
      quantity: "5",
      purchaseOrderNumber: "P".repeat(121),
    }).success).toBe(false);
  });
});
