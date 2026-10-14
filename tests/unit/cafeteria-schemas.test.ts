import { describe, expect, it } from "vitest";

import {
  cafeteriaDailyMenuSchema,
  cafeteriaMenuItemSchema,
  cafeteriaMonthlyMenuSchema,
  cafeteriaOrderSchema,
  cafeteriaPaymentSchema,
  cafeteriaRecipeIngredientSchema,
  cafeteriaStockItemSchema,
  cafeteriaStockMovementSchema,
} from "../../src/lib/cafeteria/schemas";

const menuItemId = "62b8c4dc-b60c-41a1-8cf9-3d50a3fc92d1";
const stockItemId = "f47939db-c7a7-4d32-8bc7-e77efb9911a5";
const orderId = "d141429d-7dcf-4ee2-a011-6d3047bb6c87";
const postgresUuidWithoutRfcVersion = "00000000-0000-0000-0000-000000000000";

describe("cafeteria schemas", () => {
  it("validates a priced menu item and rejects invalid prices", () => {
    expect(cafeteriaMenuItemSchema.safeParse({
      name: "Chicken sandwich",
      category: "snack",
      description: "",
      price: "250",
      allergens: "wheat",
    }).success).toBe(true);
    expect(cafeteriaMenuItemSchema.safeParse({
      name: " ",
      category: "snack",
      description: "",
      price: "-1",
      allergens: "",
    }).success).toBe(false);
  });

  it("validates scheduled menus and ingredient stock movements", () => {
    expect(cafeteriaDailyMenuSchema.safeParse({
      menuItemId,
      serviceDate: "2026-10-15",
      mealPeriod: "lunch",
      quantityLimit: "40",
    }).success).toBe(true);
    expect(cafeteriaDailyMenuSchema.safeParse({
      menuItemId,
      serviceDate: "2026-02-30",
      mealPeriod: "lunch",
      quantityLimit: "0",
    }).success).toBe(false);
    expect(cafeteriaStockItemSchema.safeParse({
      name: "Flour",
      sku: "",
      unit: "kg",
      costPerUnit: "90",
      reorderLevel: "5",
    }).success).toBe(true);
    expect(cafeteriaStockMovementSchema.safeParse({
      stockItemId,
      movementType: "waste",
      quantity: "0.5",
      unitCost: "",
      reference: "",
      notes: "",
    }).success).toBe(true);
    expect(cafeteriaStockMovementSchema.safeParse({
      stockItemId,
      movementType: "stock_out",
      quantity: "-1",
      unitCost: "",
      reference: "",
      notes: "",
    }).success).toBe(false);
  });

  it("validates monthly breakfast, lunch, and snack plans by selected month", () => {
    expect(cafeteriaMonthlyMenuSchema.safeParse({
      month: "2026-10",
      entries: [
        { menuItemId: postgresUuidWithoutRfcVersion, serviceDate: "2026-10-01", mealPeriod: "breakfast" },
        { menuItemId: menuItemId, serviceDate: "2026-10-01", mealPeriod: "lunch" },
      ],
    }).success).toBe(true);
    expect(cafeteriaMonthlyMenuSchema.safeParse({
      month: "2026-10",
      entries: [{ menuItemId, serviceDate: "2026-11-01", mealPeriod: "breakfast" }],
    }).success).toBe(false);
    expect(cafeteriaMonthlyMenuSchema.safeParse({
      month: "2026-10",
      entries: [
        { menuItemId, serviceDate: "2026-10-01", mealPeriod: "breakfast" },
        { menuItemId: stockItemId, serviceDate: "2026-10-01", mealPeriod: "breakfast" },
      ],
    }).success).toBe(false);
  });

  it("validates recipe ingredient quantities and unique order lines", () => {
    expect(cafeteriaRecipeIngredientSchema.safeParse({
      menuItemId,
      stockItemId,
      quantityPerPortion: "0.125",
    }).success).toBe(true);
    expect(cafeteriaOrderSchema.safeParse({
      customerLabel: "",
      menuItemIds: [menuItemId, stockItemId],
      quantities: ["1", "2"],
      initialPayment: "300",
      paymentMethod: "cash",
      paymentReference: "",
    }).success).toBe(true);
    expect(cafeteriaOrderSchema.safeParse({
      customerLabel: "",
      menuItemIds: [menuItemId, menuItemId],
      quantities: ["1", "1"],
      initialPayment: "0",
      paymentMethod: "cash",
      paymentReference: "",
    }).success).toBe(false);
  });

  it("requires positive payments with a supported method", () => {
    expect(cafeteriaPaymentSchema.safeParse({
      orderId,
      amount: "100",
      paymentMethod: "transfer",
      paymentReference: "TX-10",
    }).success).toBe(true);
    expect(cafeteriaPaymentSchema.safeParse({
      orderId,
      amount: "0",
      paymentMethod: "cash",
      paymentReference: "",
    }).success).toBe(false);
  });
});
