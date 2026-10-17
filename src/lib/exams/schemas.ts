import { z } from "zod";

const required = (label: string) => z.string().trim().min(1, `${label} is required.`);
const postgresUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is invalid.").refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, "Date is invalid.");

export const examTypeSchema = z.object({
  name: required("Exam type name"),
  description: z.string().trim().optional(),
});

export const gradingScaleSchema = z.object({
  name: required("Scale name"),
  description: z.string().trim().optional(),
});

export const gradeBoundarySchema = z.object({
  gradingScaleId: postgresUuid,
  grade: required("Grade"),
  minPercentage: z.coerce.number().min(0).max(100, "Percentage must be between 0 and 100."),
  maxPercentage: z.coerce.number().min(0).max(100, "Percentage must be between 0 and 100."),
  gradePoint: z.coerce.number().min(0).optional().or(z.literal("")),
  remark: z.string().trim().optional(),
}).refine((values) => values.maxPercentage >= values.minPercentage, {
  message: "Maximum percentage must be greater than or equal to the minimum percentage.",
  path: ["maxPercentage"],
});

export const examSchema = z.object({
  examTypeId: postgresUuid,
  academicSessionId: postgresUuid,
  gradingScaleId: postgresUuid.optional().or(z.literal("")),
  name: required("Exam name"),
  startsOn: isoDate,
  endsOn: isoDate,
}).refine((values) => values.endsOn >= values.startsOn, {
  message: "End date must be on or after the start date.",
  path: ["endsOn"],
});

export const examSubjectSchema = z.object({
  examId: postgresUuid,
  classId: postgresUuid,
  subjectId: postgresUuid,
  maximumMarks: z.coerce.number().positive("Maximum marks must be greater than zero."),
  passingMarks: z.coerce.number().min(0).optional().or(z.literal("")),
});

export const examScheduleSchema = z.object({
  examId: postgresUuid,
  examSubjectId: postgresUuid,
  sectionId: postgresUuid,
  academicTermId: postgresUuid,
  examinerTeacherId: postgresUuid,
  scheduledOn: isoDate,
  startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Start time is invalid."),
  endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "End time is invalid."),
  room: z.string().trim().max(80).optional(),
}).refine((data) => data.endsAt > data.startsAt, { message: "End time must be after start time.", path: ["endsAt"] });

export const markSchema = z.object({
  examSubjectId: postgresUuid,
  studentId: postgresUuid,
  obtainedMarks: z.coerce.number().min(0),
  grade: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
});

export const markRecordSchema = z.object({
  studentId: postgresUuid,
  obtainedMarks: z.coerce.number().min(0),
  grade: z.string().trim().max(20).optional(),
  remarks: z.string().trim().max(500).optional(),
});

export const marksSubmissionSchema = z.object({
  examSubjectId: postgresUuid,
  sectionId: postgresUuid,
  records: z.array(markRecordSchema).min(1, "At least one student is required."),
}).refine((values) => new Set(values.records.map((record) => record.studentId)).size === values.records.length, {
  message: "Student marks must not contain duplicate entries.",
  path: ["records"],
});

export type ExamFormState = { error?: string; success?: string };