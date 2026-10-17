import { z } from "zod";

const postgresUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const postgresUuid = z.string().regex(postgresUuidPattern);
const requiredPostgresUuid = (label: string) => z.string()
  .min(1, `Select ${label.toLowerCase()}.`)
  .regex(postgresUuidPattern, `Select a valid ${label.toLowerCase()}.`);

export const weeklyTimetableSelectionSchema = z.object({
  sessionId: requiredPostgresUuid("Academic session"),
  classId: requiredPostgresUuid("Class"),
  sectionId: requiredPostgresUuid("Section"),
});

export const timetableSchema = z.object({
  id: postgresUuid.optional().or(z.literal("")),
  academicSessionId: requiredPostgresUuid("Academic session"),
  classId: requiredPostgresUuid("Class"),
  sectionId: requiredPostgresUuid("Section"),
  subjectId: requiredPostgresUuid("Subject"),
  teacherId: requiredPostgresUuid("Teacher"),
  periodNumber: z.coerce.number().int().min(1).max(16),
  room: z.string().trim().max(80).optional(),
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  status: z.enum(["active", "inactive", "archived"]),
});

export const timetablePeriodSchema = z.object({
  name: z.string().trim().min(1, "Period name is required.").max(60),
  startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid start time."),
  endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid end time."),
}).refine((period) => period.endsAt > period.startsAt, {
  message: "Each period must end after it starts.",
  path: ["endsAt"],
});

export const timetablePeriodsSchema = z.array(timetablePeriodSchema)
  .min(1, "Configure at least one period.")
  .max(16, "A school can configure up to 16 daily periods.")
  .refine((periods) => periods.every((period, index) =>
    index === 0 || periods[index - 1]!.startsAt < period.startsAt
  ), "Periods must be listed in start-time order.")
  .refine((periods) => periods.every((period, index) =>
    index === 0 || periods[index - 1]!.endsAt <= period.startsAt
  ), "Period times cannot overlap.");

export const timetableWorkingDaysSchema = z.array(z.coerce.number().int().min(1).max(7))
  .min(1, "Select at least one working day.")
  .max(7, "There are only seven days in a week.")
  .refine((days) => new Set(days).size === days.length, "A day can only be selected once.");

export type TimetableFormState = { error?: string; success?: string };