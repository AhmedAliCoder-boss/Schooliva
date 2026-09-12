import { z } from "zod";

const requiredText = (label: string) => z.string().trim().min(1, `${label} required hai.`);
const optionalText = z.string().trim().optional();
const dateField = z.string().trim().min(1, "Date required hai.");

export const bootstrapSchoolSchema = z.object({
  name: requiredText("School name"),
  slug: requiredText("Slug").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug lowercase letters, numbers aur hyphens mein hona chahiye."),
  code: requiredText("School code").max(20),
  email: z.string().trim().email("Valid email enter karein.").optional().or(z.literal("")),
  phone: optionalText,
  timezone: requiredText("Timezone"),
  currency: z.string().trim().length(3, "Currency 3 letters ki honi chahiye.").toUpperCase(),
});

export const schoolProfileSchema = bootstrapSchoolSchema.omit({ timezone: true, currency: true });

export const settingsSchema = z.object({
  timezone: requiredText("Timezone"),
  currency: z.string().trim().length(3, "Currency 3 letters ki honi chahiye.").toUpperCase(),
  dateFormat: requiredText("Date format"),
});

export const sessionSchema = z.object({
  name: requiredText("Session name"), code: requiredText("Session code"),
  startsOn: dateField, endsOn: dateField,
  status: z.enum(["draft", "active", "completed", "archived"]),
});

export const termSchema = sessionSchema.extend({ academicSessionId: requiredText("Academic session") });
export const classSchema = z.object({ name: requiredText("Class name"), code: requiredText("Class code"), description: optionalText, status: z.enum(["active", "inactive", "archived"]) });
export const sectionSchema = z.object({ classId: requiredText("Class"), name: requiredText("Section name"), code: requiredText("Section code"), capacity: z.coerce.number().int().positive().optional().or(z.literal("")), classTeacherId: optionalText, status: z.enum(["active", "inactive", "archived"]) });
export const subjectSchema = z.object({ name: requiredText("Subject name"), code: requiredText("Subject code"), subjectType: z.enum(["core", "elective", "optional", "co_curricular"]), status: z.enum(["active", "inactive", "archived"]) });