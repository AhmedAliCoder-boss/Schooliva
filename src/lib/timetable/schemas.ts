import { z } from "zod";

export const timetableSchema = z.object({
  academicSessionId: z.string().uuid("Academic session select karein."),
  classId: z.string().uuid("Class select karein."),
  sectionId: z.string().uuid("Section select karein."),
  subjectId: z.string().uuid("Subject select karein."),
  teacherId: z.string().uuid("Teacher select karein."),
  room: z.string().trim().max(80).optional(),
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Start time invalid hai."),
  endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "End time invalid hai."),
  status: z.enum(["active", "inactive", "archived"]),
}).refine((data) => data.endsAt > data.startsAt, { message: "End time start time ke baad hona chahiye.", path: ["endsAt"] });

export type TimetableFormState = { error?: string; success?: string };