import { z } from "zod";
import { postgresUuidSchema } from "../validation/postgres-uuid";

const uuid = postgresUuidSchema;
const date = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Choose a valid date.");

export const academicPlanSchema = z.object({
  id: uuid.optional().or(z.literal("")),
  academicSessionId: uuid,
  termId: uuid.optional().or(z.literal("")),
  classId: uuid,
  subjectId: uuid,
  teacherId: uuid.optional().or(z.literal("")),
  unitNumber: z.coerce.number().int().min(1).max(500),
  title: z.string().trim().min(3).max(160),
  learningObjectives: z.string().trim().min(10).max(3000),
  keyConcepts: z.string().trim().max(2000),
  plannedLessons: z.coerce.number().int().min(1).max(200),
  plannedStartDate: date,
  plannedEndDate: date,
  assessmentPlan: z.string().trim().min(3).max(2000),
  learningResources: z.string().trim().max(2000),
  status: z.enum(["draft", "planned"]),
}).refine((value) => value.plannedEndDate >= value.plannedStartDate, {
  path: ["plannedEndDate"],
  message: "The end date must be on or after the start date.",
});

export const academicPlanProgressSchema = z.object({
  id: uuid,
  completedLessons: z.coerce.number().int().min(0).max(200),
  teacherReflection: z.string().trim().max(3000),
});

export const academicPlanArchiveSchema = z.object({
  id: uuid,
  operation: z.enum(["archive", "restore"]),
});

export type AcademicPlanFormState = { error?: string; success?: string };
