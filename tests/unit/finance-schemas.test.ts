import { describe, expect, it } from "vitest";
import { feeStructureSchema, invoiceSchema, paymentSchema } from "../../src/lib/finance/schemas";

describe("finance validation", () => {
  const sessionId = "00000000-0000-4000-8000-000000000001";
  const classId = "00000000-0000-4000-8000-000000000002";
  const invoiceId = "00000000-0000-4000-8000-000000000004";

  it("coerces valid fee amounts and due days", () => {
    const result = feeStructureSchema.parse({
      academicSessionId: sessionId,
      classId,
      feeType: "tuition",
      amount: "12500.50",
      frequency: "term",
      dueDay: "15",
    });
    expect(result.amount).toBe(12500.5);
    expect(result.dueDay).toBe(15);
  });

  it("rejects invalid identifiers and negative amounts", () => {
    expect(feeStructureSchema.safeParse({ academicSessionId: "bad", classId, feeType: "tuition", amount: -1, frequency: "term", dueDay: 15 }).success).toBe(false);
    expect(invoiceSchema.safeParse({ studentId: "bad", academicSessionId: sessionId, dueDate: "2026-09-16" }).success).toBe(false);
  });

  it("requires a positive payment and supported payment method", () => {
    expect(paymentSchema.safeParse({ invoiceId, amount: 0, paymentMethod: "cash", paymentDate: "2026-09-16" }).success).toBe(false);
    expect(paymentSchema.safeParse({ invoiceId, amount: 100, paymentMethod: "crypto", paymentDate: "2026-09-16" }).success).toBe(false);
    expect(paymentSchema.safeParse({ invoiceId, amount: "100.00", paymentMethod: "cash", paymentDate: "2026-09-16" }).success).toBe(true);
  });
});
