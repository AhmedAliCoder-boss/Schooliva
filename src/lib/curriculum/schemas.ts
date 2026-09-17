import { z } from "zod";

export const curriculumSchema = z.object({
  academicSessionId: z.string().uuid(), classId: z.string().uuid(), subjectId: z.string().uuid(),
  credits: z.coerce.number().min(0).optional().or(z.literal("")), gradingWeight: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  status: z.enum(["active", "inactive", "archived"]),
});
export const teacherSubjectSchema = z.object({ academicSessionId: z.string().uuid(), teacherId: z.string().uuid(), subjectId: z.string().uuid(), classId: z.string().uuid().optional().or(z.literal("")) });
export type CurriculumFormState = { error?: string; success?: string };