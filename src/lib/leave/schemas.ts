import { z } from "zod";

export const leaveTypeSchema = z.object({ name: z.string().trim().min(1), description: z.string().trim().optional() });

export const leaveRequestSchema = z.object({
  leaveTypeId: z.string().uuid("Leave type required hai."),
  subjectType: z.enum(["student", "teacher", "staff"]),
  subjectId: z.string().uuid("Subject required hai."),
  startDate: z.string().trim().min(1),
  endDate: z.string().trim().min(1),
  reason: z.string().trim().min(1, "Reason required hai."),
  attachmentPath: z.string().trim().optional(),
});

export const leaveDecisionSchema = z.object({
  leaveRequestId: z.string().uuid(),
  status: z.enum(["approved", "rejected", "completed"]),
  approverNote: z.string().trim().optional(),
});

export type LeaveFormState = { error?: string; success?: string };
