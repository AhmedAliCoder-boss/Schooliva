import { z } from "zod";

const requiredText = (label: string) => z.string().trim().min(1, `${label} required hai.`);
const optionalText = z.string().trim().optional();
const dateField = z.string().trim().min(1, "Date required hai.");
const supportedTimezones = new Set(["UTC", ...(typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [])]);
const supportedCurrencies = new Set(typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("currency") : []);
const timezoneField = requiredText("Timezone").refine((value) => supportedTimezones.has(value), "Timezone list se valid option select karein.");
const currencyField = z.string().trim().length(3, "Currency 3 letters ki honi chahiye.").toUpperCase().refine((value) => supportedCurrencies.has(value), "Currency list se valid option select karein.");

export const bootstrapSchoolSchema = z.object({
  name: requiredText("School name"),
  shortName: requiredText("Short name").max(30),
  slug: requiredText("Slug").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug lowercase letters, numbers aur hyphens mein hona chahiye."),
  code: requiredText("School code").max(20),
  schoolType: requiredText("School type"),
  campus: requiredText("Campus"),
  academicYear: requiredText("Academic year"),
  board: requiredText("Board"),
  medium: requiredText("Medium"),
  email: z.string().trim().email("Valid email enter karein.").optional().or(z.literal("")),
  phone: optionalText,
  website: optionalText,
  address: requiredText("Address"),
  city: requiredText("City"),
  province: requiredText("Province"),
  country: requiredText("Country"),
  principal: requiredText("Principal"),
  establishedYear: z.coerce.number().int().min(1800).max(new Date().getFullYear()),
  timezone: timezoneField,
  currency: currencyField,
});

export const schoolProfileSchema = z.object({
  name: requiredText("School name"),
  slug: requiredText("Slug").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug lowercase letters, numbers aur hyphens mein hona chahiye."),
  code: requiredText("School code").max(20),
  email: z.string().trim().email("Valid email enter karein.").optional().or(z.literal("")),
  phone: optionalText,
  website: optionalText,
  address: optionalText,
});

export const settingsSchema = z.object({
  timezone: timezoneField,
  currency: currencyField,
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