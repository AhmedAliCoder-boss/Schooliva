import { z } from "zod";

const requiredText = (label: string) => z.string().trim().min(1, `${label} is required.`);
const optionalText = z.string().trim().optional();
const dateField = z.string().trim().min(1, "Date is required.");
const supportedTimezones = new Set(["UTC", ...(typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [])]);
const supportedCurrencies = new Set(typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("currency") : []);
const timezoneField = requiredText("Timezone").refine((value) => supportedTimezones.has(value), "Select a valid timezone from the list.");
const currencyField = z.string().trim().length(3, "Currency must contain 3 letters.").toUpperCase().refine((value) => supportedCurrencies.has(value), "Select a valid currency from the list.");

export const bootstrapSchoolSchema = z.object({
  name: requiredText("School name"),
  shortName: requiredText("Short name").max(30),
  slug: requiredText("Slug").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens in the slug."),
  code: requiredText("School code").max(20),
  schoolType: requiredText("School type"),
  campus: requiredText("Campus"),
  academicYear: requiredText("Academic year"),
  board: requiredText("Board"),
  medium: requiredText("Medium"),
  email: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
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
  shortName: optionalText,
  slug: requiredText("Slug").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens in the slug."),
  code: requiredText("School code").max(20),
  schoolType: optionalText,
  campus: optionalText,
  board: optionalText,
  medium: optionalText,
  principal: optionalText,
  establishedYear: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.coerce.number().int().min(1800).max(new Date().getFullYear()).optional(),
  ),
  email: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
  phone: optionalText,
  website: z.string().trim().url("Enter a valid website URL.").optional().or(z.literal("")),
  address: optionalText,
  city: optionalText,
  state: optionalText,
  country: optionalText,
});

export const settingsSchema = z.object({
  timezone: timezoneField,
  currency: currencyField,
  dateFormat: requiredText("Date format"),
  academicYear: optionalText,
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