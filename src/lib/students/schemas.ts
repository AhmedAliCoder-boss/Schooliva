import { z } from "zod";

const optional = z.string().trim().optional();
const required = (label: string) => z.string().trim().min(1, `${label} required hai.`);

export const studentSchema = z.object({
  firstName: required("First name"), middleName: optional, lastName: required("Last name"),
  dateOfBirth: optional, gender: z.enum(["female", "male", "non_binary", "undisclosed"]).optional().or(z.literal("")),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional().or(z.literal("")),
  nationality: optional, phone: optional, email: z.string().trim().email("Valid email enter karein.").optional().or(z.literal("")), address: optional,
  admissionDate: optional, emergencyContactName: optional, emergencyContactPhone: optional,
  emergencyContactRelationship: z.enum(["father", "mother", "guardian", "other"]).optional().or(z.literal("")),
  medicalNotes: optional, previousSchool: optional,
  status: z.enum(["active", "inactive", "archived"]),
  fatherName: optional, motherName: optional, guardianName: optional, guardianPhone: optional,
  academicSessionId: optional, classId: optional, sectionId: optional, rollNumber: optional, enrolledOn: optional,
});

export type StudentFormState = { error?: string; success?: string; fieldErrors?: Record<string, string[]>; studentId?: string };