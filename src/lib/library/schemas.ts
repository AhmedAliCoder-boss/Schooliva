import { z } from "zod";

export const authorSchema = z.object({ name: z.string().trim().min(1), bio: z.string().trim().optional() });
export const categorySchema = z.object({ name: z.string().trim().min(1) });
export const publisherSchema = z.object({ name: z.string().trim().min(1) });
export const bookSchema = z.object({
  title: z.string().trim().min(1),
  isbn: z.string().trim().min(1),
  authorId: z.string().uuid(),
  categoryId: z.string().uuid(),
  publisherId: z.string().uuid(),
  edition: z.string().trim().optional(),
  yearPublished: z.coerce.number().int().min(0).max(9999).optional().or(z.literal("")),
  summary: z.string().trim().optional(),
  rackLocation: z.string().trim().optional(),
});
export const memberSchema = z.object({ memberType: z.enum(["student", "teacher"]), profileId: z.string().uuid(), studentId: z.string().uuid().optional().or(z.literal("")), teacherId: z.string().uuid().optional().or(z.literal("")), membershipNumber: z.string().trim().min(1) });
export const issueSchema = z.object({ copyId: z.string().uuid(), memberId: z.string().uuid(), dueDate: z.string().trim().min(1) });
export type LibraryFormState = { error?: string; success?: string };
