import { z } from "zod";

const required = (label: string) => z.string().trim().min(1, `${label} required hai.`);

export const examTypeSchema = z.object({
  name: required("Exam type name"),
  description: z.string().trim().optional(),
});

export const gradingScaleSchema = z.object({
  name: required("Scale name"),
  description: z.string().trim().optional(),
});

export const gradeBoundarySchema = z.object({
  gradingScaleId: z.string().uuid("Grading scale required hai."),
  grade: required("Grade"),
  minPercentage: z.coerce.number().min(0).max(100, "Percentage 0 se 100 ke darmiyan honi chahiye."),
  maxPercentage: z.coerce.number().min(0).max(100, "Percentage 0 se 100 ke darmiyan honi chahiye."),
  gradePoint: z.coerce.number().min(0).optional().or(z.literal("")),
  remark: z.string().trim().optional(),
}).refine((values) => values.maxPercentage >= values.minPercentage, {
  message: "Max percentage min percentage se kam nahi honi chahiye.",
  path: ["maxPercentage"],
});

export const examSchema = z.object({
  examTypeId: z.string().uuid("Exam type required hai."),
  academicSessionId: z.string().uuid("Academic session required hai."),
  gradingScaleId: z.string().uuid("Grading scale required hai.").optional().or(z.literal("")),
  name: required("Exam name"),
  startsOn: z.string().trim().min(1, "Start date required hai."),
  endsOn: z.string().trim().min(1, "End date required hai."),
});

export const examSubjectSchema = z.object({
  examId: z.string().uuid(),
  classId: z.string().uuid("Class required hai."),
  subjectId: z.string().uuid("Subject required hai."),
  maximumMarks: z.coerce.number().positive("Maximum marks positive houni chahiye."),
  passingMarks: z.coerce.number().min(0).optional().or(z.literal("")),
});

export const examScheduleSchema = z.object({
  examSubjectId: z.string().uuid("Exam subject required hai."),
  sectionId: z.string().uuid("Section required hai."),
  scheduledOn: required("Schedule date"),
  startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Start time invalid hai."),
  endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "End time invalid hai."),
  room: z.string().trim().max(80).optional(),
}).refine((data) => data.endsAt > data.startsAt, { message: "End time start time ke baad hona chahiye.", path: ["endsAt"] });

export const markSchema = z.object({
  examSubjectId: z.string().uuid(),
  studentId: z.string().uuid(),
  obtainedMarks: z.coerce.number().min(0),
  grade: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
});

export const markRecordSchema = z.object({
  studentId: z.string().uuid(),
  obtainedMarks: z.coerce.number().min(0),
  grade: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
});

export const marksSubmissionSchema = z.object({
  examSubjectId: z.string().uuid("Exam subject required hai."),
  records: z.array(markRecordSchema).min(1, "Kam se kam ek student required hai."),
});

export type ExamFormState = { error?: string; success?: string };