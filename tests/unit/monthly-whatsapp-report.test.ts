import { describe, expect, it } from "vitest";

import {
  buildMonthlyWhatsAppMessage,
  buildWhatsAppHref,
  getPreviousPakistanMonth,
  normalizeWhatsAppPhone,
} from "../../src/lib/admin/monthly-whatsapp-report";

describe("monthly WhatsApp report", () => {
  it("uses the previous Pakistan calendar month, including year boundaries", () => {
    expect(getPreviousPakistanMonth(new Date("2026-01-31T18:00:00.000Z"))).toEqual({
      start: "2025-11-30T19:00:00.000Z",
      end: "2025-12-31T19:00:00.000Z",
      label: "December 2025",
    });
  });

  it("normalizes Pakistani local mobile numbers and validates international numbers", () => {
    expect(normalizeWhatsAppPhone("0370 262 9117")).toBe("923702629117");
    expect(normalizeWhatsAppPhone("+92 370 262 9117")).toBe("923702629117");
    expect(normalizeWhatsAppPhone("123")).toBeNull();
  });

  it("builds an encoded WhatsApp draft with payment and promotion totals", () => {
    const message = buildMonthlyWhatsAppMessage({
      asOfDate: "18 Oct 2026",
      promotionMonth: "September 2026",
      outstandingAmount: "PKR 12,000",
      unpaidBillCount: 3,
      overdueBillCount: 1,
      schoolsWithDues: 2,
      promotions: 8,
    });

    expect(message).toContain("Outstanding: PKR 12,000 across 3 unpaid bill(s) at 2 school(s).");
    expect(message).toContain("Academic promotions completed in September 2026: 8.");
    expect(buildWhatsAppHref("03702629117", message)).toBe(
      `https://wa.me/923702629117?text=${encodeURIComponent(message)}`,
    );
    expect(buildWhatsAppHref("123", message)).toBeNull();
  });
});
