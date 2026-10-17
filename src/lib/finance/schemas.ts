import { z } from "zod";

const postgresUuid = z.string().regex(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);

export const feeStructureSchema = z.object({
  academicSessionId: postgresUuid,
  classId: z.union([postgresUuid, z.literal("all")]),
  feeType: z.enum(["admission", "tuition", "examination", "transport", "library", "laboratory", "activity", "other"]),
  amount: z.coerce.number().min(0),
  frequency: z.enum(["one_time", "monthly", "term", "quarterly", "yearly"]),
  dueDay: z.coerce.number().int().min(1).max(31),
  isOptional: z.union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")]).optional(),
  isActive: z.union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")]).optional(),
});

export const invoiceSchema = z.object({
  studentId: postgresUuid,
  academicSessionId: z.string().trim().max(100),
  dueDate: z.string().trim().min(1, "Due date is required."),
  feeStructureIds: z.array(postgresUuid).min(1, "At least one fee item is required."),
  notes: z.string().trim().optional(),
});

export const studentInvoiceScheduleSchema = z.object({
  studentId: postgresUuid,
  academicSessionId: postgresUuid,
  frequency: z.enum(["monthly", "quarterly", "yearly"]),
  feeStructureIds: z.array(postgresUuid).min(1, "At least one recurring fee item is required."),
});

export const studentInvoiceScheduleStatusSchema = z.object({
  scheduleId: postgresUuid,
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

const invoiceLineDescriptionsSchema = z.preprocess((value) => Array.isArray(value) ? value : [value], z.array(z.string().trim().min(2).max(200)).min(1).max(10));
const invoiceLineQuantitiesSchema = z.preprocess((value) => Array.isArray(value) ? value : [value], z.array(z.coerce.number().positive()).min(1).max(10));
const invoiceLinePricesSchema = z.preprocess((value) => Array.isArray(value) ? value : [value], z.array(z.coerce.number().min(0)).min(1).max(10));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Valid date required.");

export const managementInvoiceSchema = z.object({
  recipientName: z.string().trim().min(2).max(160),
  recipientEmail: z.union([z.literal(""), z.string().trim().email()]).optional(),
  recipientPhone: z.string().trim().max(40).optional(),
  dueDate: isoDate,
  itemDescription: invoiceLineDescriptionsSchema,
  itemQuantity: invoiceLineQuantitiesSchema,
  itemUnitPrice: invoiceLinePricesSchema,
  notes: z.string().trim().max(1000).optional(),
}).superRefine((invoice, context) => {
  if (invoice.itemDescription.length !== invoice.itemQuantity.length
    || invoice.itemDescription.length !== invoice.itemUnitPrice.length) {
    context.addIssue({ code: "custom", path: ["itemDescription"], message: "Every invoice item must have a description, quantity, and unit price." });
  }
});

export const feeStructureStatusSchema = z.object({
  feeStructureId: postgresUuid,
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const feeStructureDeleteSchema = z.object({
  feeStructureId: postgresUuid,
});

export const paymentSchema = z.object({
  invoiceId: postgresUuid,
  amount: z.coerce.number().positive("Payment amount must be greater than zero."),
  paymentMethod: z.enum(["cash", "bank_transfer", "card", "upi", "cheque", "other"]),
  paymentDate: z.string().trim().min(1, "Payment date is required."),
  notes: z.string().trim().optional(),
});

export const expenseSchema = z.object({
  category: z.enum(["salary", "utilities", "supplies", "maintenance", "transport", "other"]),
  description: z.string().trim().min(2, "Expense description is required.").max(160),
  vendor: z.string().trim().max(120).optional(),
  amount: z.coerce.number().positive("Expense amount must be greater than zero."),
  paymentMethod: z.enum(["cash", "bank_transfer", "card", "upi", "cheque", "other"]),
  expenseDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "A valid expense date is required."),
  reference: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
});

export type FinanceFormState = { error?: string; success?: string };
