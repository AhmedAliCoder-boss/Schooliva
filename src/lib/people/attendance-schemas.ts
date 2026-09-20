import { z } from "zod";

const personAttendanceRecordSchema = z.object({
  personId: z.string().min(1),
  personType: z.enum(["teacher", "staff"]),
  status: z.enum(["present", "absent", "late", "excused", "half_day"]),
  remarks: z.string().max(500).optional(),
});

export const peopleAttendanceSubmissionSchema = z.object({
  attendanceDate: z.string().min(1),
  records: z.array(personAttendanceRecordSchema).min(1),
});

export type PeopleAttendanceFormState = { error?: string; success?: string };