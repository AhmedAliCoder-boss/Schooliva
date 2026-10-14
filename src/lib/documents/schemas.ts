import { z } from "zod";

export const certificateSchema = z.object({
  studentId: z.string().uuid("Student required hai."),
  certificateType: z.enum(["character", "bonafide", "leaving", "enrollment"]),
  certificateNumber: z.string().trim().max(80).optional(),
  issuedOn: z.string().trim().min(1),
  content: z.string().trim().optional(),
});

const certificateDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid date.");

export const characterCertificateSchema = z.object({
  studentId: z.string().uuid("Select a student."),
  certificateNumber: z.string().regex(/^\d{4}$/, "Certificate number must be four digits."),
  issuedOn: certificateDateSchema,
  conduct: z.string().trim().min(1).max(200),
  certificateText: z.string().trim().min(1, "Certificate statement is required.").max(2000),
  remarks: z.string().trim().max(1000),
});

export const slcTcSchema = z.object({
  studentId: z.string().uuid("Select a student."),
  certificateTitle: z.enum(["School Leaving Certificate", "Transfer Certificate", "School Completion Certificate"]),
  certificateNumber: z.string().regex(/^\d{4}$/, "Certificate number must be four digits."),
  issuedOn: certificateDateSchema,
  dateOfLeaving: certificateDateSchema,
  dateOfAdmission: certificateDateSchema,
  dateOfBirth: certificateDateSchema,
  lastClassSection: z.string().refine((value) => {
    const [classId, sectionId, extra] = value.split("|");
    return !extra && z.string().uuid().safeParse(classId).success && z.string().uuid().safeParse(sectionId).success;
  }, "Select an active class and section."),
  academicSessionId: z.string().trim().max(100),
  reasonForLeaving: z.string().trim().min(1).max(1000),
  conduct: z.string().trim().min(1).max(200),
  feeStatus: z.enum(["cleared", "pending", "waived", "not_recorded"]),
  lastExamId: z.union([z.string().uuid(), z.literal("")]),
  promotionStatus: z.enum(["Promoted", "Not promoted", "Retained", "Completed"]),
  remarks: z.string().trim().max(1000),
}).refine((certificate) => certificate.dateOfLeaving >= certificate.dateOfAdmission, {
  message: "Certificate date cannot be earlier than admission date.",
  path: ["dateOfLeaving"],
});

export const certificateReviewSchema = z.object({
  certificateId: z.string().uuid("Certificate required hai."),
  decision: z.enum(["approve", "reject"]),
  notes: z.string().trim().max(1000).optional(),
});

export type DocumentFormState = { error?: string; success?: string };

export function nextFourDigitCertificateNumber(existingNumbers: string[]) {
  const highestUsed = existingNumbers.reduce((highest, number) => {
    if (!/^\d{4}$/.test(number)) return highest;
    return Math.max(highest, Number(number));
  }, 0);
  return highestUsed >= 9999 ? null : String(highestUsed + 1).padStart(4, "0");
}
