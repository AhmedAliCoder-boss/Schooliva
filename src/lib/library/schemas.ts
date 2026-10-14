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
export const copyBatchSchema = z.object({
  bookId: z.string().uuid(),
  prefix: z.string().trim().regex(/^[A-Za-z0-9._-]+$/, "Use only letters, numbers, dots, dashes, or underscores in the copy prefix.").max(24),
  quantity: z.coerce.number().int().min(1).max(100),
});
export const memberSchema = z.object({
  memberType: z.enum(["student", "teacher"]),
  studentId: z.string().uuid().optional().or(z.literal("")),
  teacherId: z.string().uuid().optional().or(z.literal("")),
  membershipNumber: z.string().trim().min(1).max(50),
}).refine((member) => member.memberType === "student"
  ? Boolean(member.studentId) && !member.teacherId
  : Boolean(member.teacherId) && !member.studentId, {
  message: "Select one member matching the selected member type.",
  path: ["memberType"],
});
export const issueSchema = z.object({
  copyId: z.string().uuid(),
  memberId: z.string().uuid(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((issue) => {
  const date = new Date(`${issue.dueDate}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === issue.dueDate;
}, { message: "Enter a valid due date.", path: ["dueDate"] });
export const returnSchema = z.object({
  transactionId: z.string().uuid(),
  fineAmount: z.coerce.number().finite().min(0).max(10000000),
});
export const memberStatusSchema = z.object({
  memberId: z.string().uuid(),
  status: z.enum(["active", "inactive", "blocked"]),
});
export const copyStatusSchema = z.object({
  copyId: z.string().uuid(),
  status: z.enum(["available", "reserved", "lost", "damaged"]),
  conditionNote: z.string().trim().max(500),
});
export type LibraryFormState = { error?: string; success?: string };
