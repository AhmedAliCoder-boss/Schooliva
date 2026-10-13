import { z } from "zod";

const optionalText = z.string().trim().max(2000).optional().default("");
const postgresUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export const jobOpeningSchema = z.object({
  title: z.string().trim().min(2).max(160),
  department: z.string().trim().max(100).optional().default(""),
  employeeType: z.enum(["teacher", "staff"]),
  employmentType: z.enum(["full_time", "part_time", "contract", "temporary"]),
  location: z.string().trim().max(160).optional().default(""),
  description: z.string().trim().max(5000).optional().default(""),
  requirements: z.string().trim().max(5000).optional().default(""),
  closingDate: z.string().optional().default(""),
  status: z.enum(["draft", "open", "closed"]).default("open"),
});

export const candidateSchema = z.object({
  candidateName: z.string().trim().min(2).max(160),
  email: z.union([z.literal(""), z.string().trim().email().max(254)]).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  jobId: z.string().uuid().or(z.literal("")).optional().default(""),
  source: z.enum(["walk_in", "referral", "website", "social_media", "other"]),
  notes: optionalText,
});

export const candidateStageSchema = z.object({
  candidateId: z.string().uuid(),
  jobId: z.string().uuid().or(z.literal("")).optional().default(""),
  stage: z.enum(["applied", "screening", "interview", "offer", "rejected"]),
});

export const interviewSchema = z.object({
  candidateId: z.string().uuid(),
  scheduledAt: z.string().min(1).refine((value) => !Number.isNaN(Date.parse(value))),
  interviewType: z.enum(["in_person", "video", "phone"]),
  location: z.string().trim().max(300).optional().default(""),
  interviewer: z.string().trim().max(160).optional().default(""),
  notes: optionalText,
});

export const interviewStatusSchema = z.object({
  interviewId: z.string().uuid(),
  status: z.enum(["completed", "cancelled"]),
});

export const employeeExitRequestSchema = z.object({
  employeeId: z.string().uuid(),
  employeeType: z.enum(["teacher", "staff"]),
  actionType: z.enum(["resignation", "termination", "warning"]),
  terminationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
    }, "Enter a valid termination date."),
  reason: z.string().trim().min(3).max(500),
  notes: z.string().trim().max(2000).optional().default(""),
});

export const employeeExitReviewSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  decisionNotes: z.string().trim().max(2000).optional().default(""),
});

export const hireSubjectAssignmentsSchema = z.object({
  candidateId: postgresUuid,
  employeeType: z.enum(["teacher", "staff"]),
  academicSessionId: z.union([postgresUuid, z.literal("")]),
  subjectAssignments: z.array(z.object({
    subjectId: postgresUuid,
    classId: z.union([postgresUuid, z.literal("")]),
  })).max(100),
}).superRefine((value, context) => {
  if (value.employeeType === "teacher") {
    if (!value.academicSessionId) {
      context.addIssue({ code: "custom", path: ["academicSessionId"], message: "Choose an academic session." });
    }
    if (!value.subjectAssignments.length) {
      context.addIssue({ code: "custom", path: ["subjectAssignments"], message: "Assign at least one subject to the teacher." });
    }
  } else if (value.subjectAssignments.length || value.academicSessionId) {
    context.addIssue({ code: "custom", path: ["subjectAssignments"], message: "Subject assignments are only for teacher hires." });
  }
  const keys = value.subjectAssignments.map((assignment) => `${assignment.subjectId}:${assignment.classId}`);
  if (new Set(keys).size !== keys.length) {
    context.addIssue({ code: "custom", path: ["subjectAssignments"], message: "Remove duplicate subject and class assignments." });
  }
});

export type HrmFormState = {
  error?: string;
  success?: string;
  employeeUserId?: string;
  employeeCode?: string;
  fieldErrors?: Record<string, string[]>;
};
