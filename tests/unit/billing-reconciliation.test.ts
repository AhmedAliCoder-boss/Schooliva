import { describe, expect, it } from "vitest";

import { reconcileInvoiceStatus } from "../../src/lib/billing-reconciliation";

describe("billing reconciliation", () => {
  it("marks invoice as paid when amount has been fully settled", () => {
    expect(reconcileInvoiceStatus({ total: 2500, paidAmount: 2500, dueDate: "2026-10-02" })).toMatchObject({
      status: "paid",
      remainingAmount: 0,
    });
  });

  it("marks invoice as partially paid when a balance remains", () => {
    expect(reconcileInvoiceStatus({ total: 2500, paidAmount: 1200, dueDate: "2026-10-02" })).toMatchObject({
      status: "partially_paid",
      remainingAmount: 1300,
    });
  });

  it("marks invoice as overdue when due date has passed with an unpaid balance", () => {
    expect(reconcileInvoiceStatus({ total: 2500, paidAmount: 0, dueDate: "2024-01-01" })).toMatchObject({
      status: "overdue",
      remainingAmount: 2500,
    });
  });
});
