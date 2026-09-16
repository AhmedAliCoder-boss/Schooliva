import { z } from "zod";

export const certificateSchema = z.object({
  studentId: z.string().uuid("Student required hai."),
  certificateType: z.enum(["character", "bonafide", "leaving", "enrollment"]),
  certificateNumber: z.string().trim().min(1),
  issuedOn: z.string().trim().min(1),
  content: z.string().trim().optional(),
});

export type DocumentFormState = { error?: string; success?: string };
