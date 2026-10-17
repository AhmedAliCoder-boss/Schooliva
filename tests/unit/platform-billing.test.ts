import { describe, expect, it } from "vitest";

import { addDaysToDate, getBillingPeriodEnd, getPlatformInvoiceAmount } from "../../src/lib/platform-billing";

describe("platform subscription billing", () => {
  it("calculates monthly periods without overflowing the end of a month", () => {
    expect(getBillingPeriodEnd("2026-01-31", "monthly")).toBe("2026-02-27");
    expect(getBillingPeriodEnd("2026-02-01", "monthly")).toBe("2026-02-28");
  });

  it("calculates annual periods and validates custom contract dates", () => {
    expect(getBillingPeriodEnd("2024-02-29", "annual")).toBe("2025-02-27");
    expect(getBillingPeriodEnd("2026-05-01", "custom", "2026-08-31")).toBe("2026-08-31");
    expect(() => getBillingPeriodEnd("2026-05-01", "custom", "2026-04-30")).toThrow();
  });

  it("limits recurring invoice periods to the signed agreement end date", () => {
    expect(getBillingPeriodEnd("2026-05-01", "monthly", "2026-05-20")).toBe("2026-05-20");
    expect(() => getBillingPeriodEnd("2026-05-21", "monthly", "2026-05-20")).toThrow();
  });

  it("calculates invoice totals and due dates", () => {
    expect(getPlatformInvoiceAmount("annual", 150)).toBe(1800);
    expect(getPlatformInvoiceAmount("monthly", 150)).toBe(150);
    expect(addDaysToDate("2026-10-17", 7)).toBe("2026-10-24");
  });
});
