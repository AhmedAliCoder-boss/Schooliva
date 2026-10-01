import { describe, expect, it } from "vitest";

import {
  buildFeeOverdueNotificationPayload,
  shouldDispatchFeeOverdueNotification,
} from "../../src/lib/notifications/dispatch";

describe("fee overdue notifications", () => {
  it("builds a clear overdue invoice notification payload", () => {
    expect(buildFeeOverdueNotificationPayload({
      schoolId: "school-1",
      invoiceId: "invoice-1",
      invoiceNumber: "INV-1001",
      amount: 2500,
      dueDate: "2026-09-15",
    })).toEqual({
      schoolId: "school-1",
      eventType: "fee_overdue",
      title: "Invoice overdue",
      message: "Invoice INV-1001 is overdue by 2500.00. The due date was 2026-09-15.",
      entityType: "fee_invoices",
      entityId: "invoice-1",
      metadata: {
        invoice_number: "INV-1001",
        amount: 2500,
        due_date: "2026-09-15",
      },
    });
  });

  it("suppresses duplicate notifications within the cooldown window", () => {
    expect(shouldDispatchFeeOverdueNotification([
      { created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString() },
    ])).toBe(false);

    expect(shouldDispatchFeeOverdueNotification([
      { created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString() },
    ])).toBe(true);
  });
});
