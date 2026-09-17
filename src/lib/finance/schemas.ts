import { z } from "zod";

export const feeStructureSchema = z.object({
  academicSessionId: z.string().uuid("Academic session required hai."),
  classId: z.string().uuid("Class required hai."),
  feeType: z.enum(["admission", "tuition", "examination", "transport", "library", "laboratory", "activity", "other"]),
  amount: z.coerce.number().min(0),
  frequency: z.enum(["one_time", "monthly", "term", "quarterly", "yearly"]),
  dueDay: z.coerce.number().int().min(1).max(31),
  isOptional: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const invoiceSchema = z.object({
  studentId: z.string().uuid("Student required hai."),
  academicSessionId: z.string().uuid("Academic session required hai."),
  dueDate: z.string().trim().min(1, "Due date required hai."),
  feeStructureIds: z.array(z.string().uuid()).optional().default([]),
  notes: z.string().trim().optional(),
});

export const paymentSchema = z.object({
  invoiceId: z.string().uuid("Invoice required hai."),
  amount: z.coerce.number().positive("Payment amount positive hona chahiye."),
  paymentMethod: z.enum(["cash", "bank_transfer", "card", "upi", "cheque", "other"]),
  paymentDate: z.string().trim().min(1, "Payment date required hai."),
  notes: z.string().trim().optional(),
});

export type FinanceFormState = { error?: string; success?: string };
