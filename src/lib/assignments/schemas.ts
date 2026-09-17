import { z } from "zod";

export const assignmentSchema = z.object({
  academicSessionId: z.string().uuid("Academic session required hai."),
  classId: z.string().uuid("Class required hai."),
  sectionId: z.string().uuid("Section required hai."),
  subjectId: z.string().uuid("Subject required hai."),
  title: z.string().trim().min(1, "Title required hai."),
  description: z.string().trim().optional(),
  issueDate: z.string().trim().min(1, "Issue date required hai."),
  dueDate: z.string().trim().min(1, "Due date required hai."),
  maxMarks: z.coerce.number().min(0).optional().or(z.literal("")),
});

export const submissionSchema = z.object({
  assignmentId: z.string().uuid("Assignment required hai."),
  content: z.string().trim().optional(),
  marks: z.coerce.number().min(0).optional().or(z.literal("")),
  feedback: z.string().trim().optional(),
});

export type AssignmentFormState = { error?: string; success?: string };
