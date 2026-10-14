import { describe, expect, it } from "vitest";

import { summarizeInvoiceStatuses } from "../../src/lib/finance/invoice-statistics";

describe("invoice status statistics", () => {
  it("summarizes paid, pending, and partially paid invoice counts and amounts", () => {
    expect(summarizeInvoiceStatuses([
      { status: "paid", total: 1200, paidAmount: 1200, remainingAmount: 0 },
      { status: "unpaid", total: 900, paidAmount: 0, remainingAmount: 900 },
      { status: "overdue", total: 500, paidAmount: 0, remainingAmount: 500 },
      { status: "partially_paid", total: 1000, paidAmount: 400, remainingAmount: 600 },
    ])).toEqual({
      paid: { count: 1, amount: 1200 },
      pending: { count: 2, amount: 1400 },
      partiallyPaid: { count: 1, amount: 600 },
    });
  });

  it("does not include cancelled invoices in status totals", () => {
    expect(summarizeInvoiceStatuses([
      { status: "cancelled", total: 1000, paidAmount: 0, remainingAmount: 1000 },
      { status: "paid", total: 500, paidAmount: 500, remainingAmount: 0 },
    ])).toMatchObject({
      paid: { count: 1, amount: 500 },
      pending: { count: 0, amount: 0 },
      partiallyPaid: { count: 0, amount: 0 },
    });
  });
});
