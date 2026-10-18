import { z } from "zod";
import { postgresUuidSchema } from "../validation/postgres-uuid";

export const assignmentSchema = z.object({
  academicSessionId: z.string().min(1, "Select an academic session.").pipe(postgresUuidSchema),
  classId: z.string().min(1, "Select a class.").pipe(postgresUuidSchema),
  sectionId: z.string().min(1, "Select a section.").pipe(postgresUuidSchema),
  subjectId: z.string().min(1, "Select a subject.").pipe(postgresUuidSchema),
  teacherId: z.string().min(1, "Assign a teacher to this assignment.").pipe(postgresUuidSchema),
  title: z.string().trim().min(1, "Title is required."),
  description: z.string().trim().optional(),
  issueDate: z.iso.date("Issue date is required."),
  dueDate: z.iso.date("Due date is required."),
  maxMarks: z.preprocess(
    (value) => value === "" || value === null ? undefined : value,
    z.coerce.number().min(0).max(999.99).optional(),
  ),
}).refine((assignment) => assignment.dueDate >= assignment.issueDate, {
  message: "Due date must be on or after the issue date.",
  path: ["dueDate"],
});

export const submissionSchema = z.object({
  assignmentId: z.string().min(1, "Select an assignment.").pipe(postgresUuidSchema),
  content: z.string().trim().optional(),
});

export const assignmentReviewSchema = z.object({
  submissionId: z.string().min(1, "Select a submission.").pipe(postgresUuidSchema),
  marks: z.preprocess((value) => value === "" ? "" : value, z.union([z.literal(""), z.coerce.number().min(0).max(999.99)])),
  feedback: z.string().trim().max(2000, "Feedback must be 2,000 characters or fewer."),
}).refine((review) => review.marks !== "" || review.feedback.length > 0, {
  message: "Enter marks or feedback before saving a review.",
});

export const assignmentStatusSchema = z.object({
  assignmentId: z.string().min(1, "Select an assignment.").pipe(postgresUuidSchema),
  status: z.enum(["open", "closed"]),
});

export type AssignmentFormState = { error?: string; success?: string };
