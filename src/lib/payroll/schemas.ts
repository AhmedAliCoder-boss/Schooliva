import { z } from "zod";

export const payrollPolicySchema = z.object({
  workingDaysPerMonth: z.coerce.number().int().min(1).max(31),
  deductAbsences: z.enum(["true", "false"]).transform((value) => value === "true"),
  halfDayDeductionFactor: z.coerce.number().min(0).max(1),
  deductExcusedDays: z.enum(["true", "false"]).transform((value) => value === "true"),
  lateMarksPerDayDeduction: z.coerce.number().int().min(0).max(31),
});

export const payrollCompensationSchema = z.object({
  employee: z.string()
    .regex(/^(teacher|staff):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Select a valid employee record.")
    .transform((value) => {
      const [type, employeeId] = value.split(":");
      const employeeType: "teacher" | "staff" = type === "teacher" ? "teacher" : "staff";
      return { employeeType, employeeId };
    }),
  monthlySalary: z.coerce.number().positive(),
}).transform(({ employee, monthlySalary }) => ({ ...employee, monthlySalary }));

export const compensationComponentSchema = z.object({
  compensationId: z.string().uuid(),
  componentType: z.enum(["allowance", "deduction"]),
  name: z.string().trim().min(2).max(80),
  amount: z.coerce.number().positive(),
});

export const payrollPeriodSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

export const payrollSettlementSchema = z.object({
  payrollItemId: z.string().uuid(),
  paymentMethod: z.enum(["cash", "bank_transfer", "card", "upi", "cheque", "other"]),
  reference: z.string().trim().min(2).max(80),
});

export const payrollRunActionSchema = z.object({
  payrollRunId: z.string().uuid(),
});

export const payrollStatusSchema = z.object({
  id: z.string().uuid(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});
