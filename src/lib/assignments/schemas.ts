import { z } from "zod";

export const assignmentSchema = z.object({
  academicSessionId: z.string().uuid("Academic session is required."),
  classId: z.string().uuid("Class is required."),
  sectionId: z.string().uuid("Section is required."),
  subjectId: z.string().uuid("Subject is required."),
  title: z.string().trim().min(1, "Title is required."),
  description: z.string().trim().optional(),
  issueDate: z.string().trim().min(1, "Issue date is required."),
  dueDate: z.string().trim().min(1, "Due date is required."),
  maxMarks: z.coerce.number().min(0).optional().or(z.literal("")),
});

export const submissionSchema = z.object({
  assignmentId: z.string().uuid("Assignment is required."),
  content: z.string().trim().optional(),
  marks: z.coerce.number().min(0).optional().or(z.literal("")),
  feedback: z.string().trim().optional(),
});

export type AssignmentFormState = { error?: string; success?: string };
