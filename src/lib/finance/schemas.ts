import { z } from "zod";

export const feeStructureSchema = z.object({
  academicSessionId: z.string().uuid("Academic session required hai."),
  classId: z.string().uuid("Class required hai."),
  feeType: z.enum(["admission", "tuition", "examination", "transport", "library", "laboratory", "activity", "other"]),
  amount: z.coerce.number().min(0),
  frequency: z.enum(["one_time", "monthly", "term", "quarterly", "yearly"]),
  dueDay: z.coerce.number().int().min(1).max(31),
  isOptional: z.union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")]).optional(),
  isActive: z.union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")]).optional(),
});

export const invoiceSchema = z.object({
  studentId: z.string().uuid("Student required hai."),
  academicSessionId: z.string().uuid("Academic session required hai."),
  dueDate: z.string().trim().min(1, "Due date required hai."),
  feeStructureIds: z.array(z.string().uuid()).min(1, "At least one fee item is required."),
  notes: z.string().trim().optional(),
});

export const paymentSchema = z.object({
  invoiceId: z.string().uuid("Invoice required hai."),
  amount: z.coerce.number().positive("Payment amount positive hona chahiye."),
  paymentMethod: z.enum(["cash", "bank_transfer", "card", "upi", "cheque", "other"]),
  paymentDate: z.string().trim().min(1, "Payment date required hai."),
  notes: z.string().trim().optional(),
});

export const expenseSchema = z.object({
  category: z.enum(["salary", "utilities", "supplies", "maintenance", "transport", "other"]),
  description: z.string().trim().min(2, "Expense description required hai.").max(160),
  vendor: z.string().trim().max(120).optional(),
  amount: z.coerce.number().positive("Expense amount positive hona chahiye."),
  paymentMethod: z.enum(["cash", "bank_transfer", "card", "upi", "cheque", "other"]),
  expenseDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Valid expense date required hai."),
  reference: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
});

export type FinanceFormState = { error?: string; success?: string };
