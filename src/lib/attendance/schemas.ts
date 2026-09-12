import { z } from "zod";

export const attendanceStatus = z.enum(["present", "absent", "late", "excused", "half_day"]);
export const attendanceRecordSchema = z.object({ studentId: z.string().uuid(), enrollmentId: z.string().uuid(), status: attendanceStatus, remarks: z.string().trim().max(500).optional() });
export const attendanceSubmissionSchema = z.object({ attendanceDate: z.string().min(1), classId: z.string().uuid(), sectionId: z.string().uuid(), records: z.array(attendanceRecordSchema).min(1) });
export type AttendanceFormState = { error?: string; success?: string };