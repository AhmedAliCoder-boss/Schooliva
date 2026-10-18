import { z } from "zod";
import { postgresUuidSchema } from "../validation/postgres-uuid";

export const curriculumSchema = z.object({
  academicSessionId: postgresUuidSchema, classId: postgresUuidSchema, subjectId: postgresUuidSchema,
  credits: z.coerce.number().min(0).optional().or(z.literal("")), gradingWeight: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  status: z.enum(["active", "inactive", "archived"]),
});
export const teacherSubjectSchema = z.object({ academicSessionId: postgresUuidSchema, teacherId: postgresUuidSchema, subjectId: postgresUuidSchema, classId: postgresUuidSchema.optional().or(z.literal("")) });
export type CurriculumFormState = { error?: string; success?: string };