import { describe, expect, it } from "vitest";
import {
  expenseSchema,
  feeStructureDeleteSchema,
  feeStructureSchema,
  feeStructureStatusSchema,
  invoiceSchema,
  managementInvoiceSchema,
  paymentSchema,
  studentInvoiceScheduleSchema,
} from "../../src/lib/finance/schemas";

describe("finance validation", () => {
  const sessionId = "00000000-0000-4000-8000-000000000001";
  const classId = "00000000-0000-4000-8000-000000000002";
  const invoiceId = "00000000-0000-4000-8000-000000000004";
  const postgresCompatibleSessionId = "30000000-0000-0000-0000-000000000001";

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
    expect(feeStructureSchema.parse({
      academicSessionId: sessionId,
      classId,
      feeType: "tuition",
      amount: "100",
      frequency: "monthly",
      dueDay: "1",
      isOptional: "false",
      isActive: "false",
    })).toMatchObject({ isOptional: false, isActive: false });
    expect(feeStructureSchema.parse({
      academicSessionId: sessionId,
      classId: "all",
      feeType: "tuition",
      amount: "100",
      frequency: "monthly",
      dueDay: "1",
    }).classId).toBe("all");
  });

  it("rejects invalid identifiers and negative amounts", () => {
    expect(feeStructureSchema.safeParse({ academicSessionId: "bad", classId, feeType: "tuition", amount: -1, frequency: "term", dueDay: 15 }).success).toBe(false);
    expect(invoiceSchema.safeParse({ studentId: "bad", academicSessionId: sessionId, dueDate: "2026-09-16" }).success).toBe(false);
    expect(feeStructureSchema.safeParse({ academicSessionId: postgresCompatibleSessionId, classId: postgresCompatibleSessionId, feeType: "tuition", amount: 100, frequency: "monthly", dueDay: 1 }).success).toBe(true);
  });

  it("requires a positive payment and supported payment method", () => {
    expect(paymentSchema.safeParse({ invoiceId, amount: 0, paymentMethod: "cash", paymentDate: "2026-09-16" }).success).toBe(false);
    expect(paymentSchema.safeParse({ invoiceId, amount: 100, paymentMethod: "crypto", paymentDate: "2026-09-16" }).success).toBe(false);
    expect(paymentSchema.safeParse({ invoiceId, amount: "100.00", paymentMethod: "cash", paymentDate: "2026-09-16" }).success).toBe(true);
  });

  it("validates fee structure status and removal requests", () => {
    expect(feeStructureStatusSchema.parse({ feeStructureId: classId, isActive: "false" })).toEqual({
      feeStructureId: classId,
      isActive: false,
    });
    expect(feeStructureStatusSchema.parse({ feeStructureId: classId, isActive: "true" }).isActive).toBe(true);
    expect(feeStructureStatusSchema.safeParse({ feeStructureId: "bad", isActive: "true" }).success).toBe(false);
    expect(feeStructureStatusSchema.safeParse({ feeStructureId: classId, isActive: "yes" }).success).toBe(false);
    expect(feeStructureDeleteSchema.safeParse({ feeStructureId: classId }).success).toBe(true);
    expect(feeStructureDeleteSchema.safeParse({ feeStructureId: "bad" }).success).toBe(false);
  });

  it("requires invoice fee items and validates expense entries", () => {
    expect(invoiceSchema.safeParse({
      studentId: "70000000-0000-0000-0000-000000000001",
      academicSessionId: "",
      dueDate: "2026-09-16",
      feeStructureIds: ["50000000-0000-0000-0000-000000000001"],
    }).success).toBe(true);
    expect(invoiceSchema.safeParse({
      studentId: "70000000-0000-0000-0000-000000000001",
      academicSessionId: sessionId,
      dueDate: "2026-09-16",
      feeStructureIds: ["50000000-0000-0000-0000-000000000001"],
    }).success).toBe(true);
    expect(invoiceSchema.safeParse({ studentId: invoiceId, academicSessionId: sessionId, dueDate: "2026-09-16", feeStructureIds: ["bad"] }).success).toBe(false);
    expect(expenseSchema.safeParse({
      category: "utilities",
      description: "Electricity bill",
      amount: "1200.50",
      paymentMethod: "bank_transfer",
      expenseDate: "2026-09-16",
    }).success).toBe(true);
    expect(expenseSchema.safeParse({
      category: "unapproved",
      description: "Electricity bill",
      amount: "-1",
      paymentMethod: "crypto",
      expenseDate: "2026-09-16",
    }).success).toBe(false);
  });

  it("validates recurring invoice plans and itemized management invoices", () => {
    const studentId = "70000000-0000-0000-0000-000000000001";
    const structureId = "50000000-0000-0000-0000-000000000001";
    expect(studentInvoiceScheduleSchema.parse({
      studentId,
      academicSessionId: sessionId,
      frequency: "quarterly",
      feeStructureIds: [structureId],
    }).frequency).toBe("quarterly");
    expect(studentInvoiceScheduleSchema.safeParse({
      studentId,
      academicSessionId: sessionId,
      frequency: "term",
      feeStructureIds: [],
    }).success).toBe(false);
    expect(managementInvoiceSchema.parse({
      recipientName: "Transport provider",
      recipientEmail: "",
      dueDate: "2026-10-30",
      itemDescription: ["Bus hire", "Fuel"],
      itemQuantity: ["2", "1"],
      itemUnitPrice: ["5000", "1500.50"],
    })).toMatchObject({
      itemDescription: ["Bus hire", "Fuel"],
      itemQuantity: [2, 1],
      itemUnitPrice: [5000, 1500.5],
    });
    expect(managementInvoiceSchema.safeParse({
      recipientName: "Transport provider",
      dueDate: "2026-10-30",
      itemDescription: ["Bus hire"],
      itemQuantity: ["2", "1"],
      itemUnitPrice: ["5000"],
    }).success).toBe(false);
  });
});
