import { describe, expect, it } from "vitest";

import { dueInvoiceScheduleDates, invoiceScheduleDate } from "../../src/lib/finance/invoice-schedule";

describe("student invoice schedule", () => {
  it("keeps monthly invoices anchored to the original joining day", () => {
    expect(dueInvoiceScheduleDates("2026-01-31", "monthly", "2026-04-30")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("uses three-month and twelve-month intervals from the joining date", () => {
    expect(invoiceScheduleDate("2024-02-29", "quarterly", 1)).toBe("2024-05-29");
    expect(invoiceScheduleDate("2024-02-29", "yearly", 1)).toBe("2025-02-28");
  });

  it("returns every elapsed billing period for catch-up generation", () => {
    expect(dueInvoiceScheduleDates("2025-06-15", "quarterly", "2026-04-14")).toEqual([
      "2025-06-15",
      "2025-09-15",
      "2025-12-15",
      "2026-03-15",
    ]);
  });

  it("rejects invalid dates and period indexes", () => {
    expect(() => invoiceScheduleDate("2026-02-30", "monthly", 0)).toThrow(RangeError);
    expect(() => invoiceScheduleDate("2026-01-01", "monthly", -1)).toThrow(RangeError);
  });
});
