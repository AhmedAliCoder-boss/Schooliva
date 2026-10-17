import { z } from "zod";

const required = (label: string) => z.string().trim().min(1, `${label} is required.`);
const optional = z.string().trim().optional();

export const parentSchema = z.object({
  firstName: required("First name"), lastName: required("Last name"), relationship: optional,
  phone: optional, email: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")), address: optional,
  emergencyContactName: optional, emergencyContactPhone: optional, profileId: optional,
});

export const relationshipSchema = z.object({
  studentId: required("Student"), relationship: z.enum(["father", "mother", "guardian", "other"]), isPrimary: z.boolean().default(false),
});

export type ParentFormState = { error?: string; success?: string; fieldErrors?: Record<string, string[]> };