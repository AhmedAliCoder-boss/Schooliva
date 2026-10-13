import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Valid date required hai.");

export const leaveTypeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
});

export const leaveRequestSchema = z.object({
  leaveTypeId: z.string().uuid("Leave type required hai."),
  subjectType: z.enum(["student", "teacher", "staff"]),
  subjectId: z.string().uuid("Subject required hai."),
  startDate: isoDate,
  endDate: isoDate,
  reason: z.string().trim().min(1, "Reason required hai.").max(2000),
  attachmentPath: z.string().trim().max(500).optional(),
}).refine((request) => request.endDate >= request.startDate, {
  message: "End date start date se pehle nahi ho sakti.",
  path: ["endDate"],
});

export const leaveDecisionSchema = z.object({
  leaveRequestId: z.string().uuid(),
  status: z.enum(["approved", "rejected", "completed"]),
  approverNote: z.string().trim().max(1000).optional(),
});

export type LeaveFormState = { error?: string; success?: string };
