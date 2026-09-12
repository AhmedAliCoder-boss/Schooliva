import { z } from "zod";

const required = (label: string) => z.string().trim().min(1, `${label} required hai.`);
const optional = z.string().trim().optional();
const status = z.enum(["active", "inactive", "on_leave", "terminated"]);

export const teacherSchema = z.object({
  employeeCode: required("Employee ID"), firstName: required("First name"), lastName: required("Last name"),
  gender: z.enum(["female", "male", "non_binary", "undisclosed"]).optional().or(z.literal("")), dateOfBirth: optional,
  email: z.string().trim().email("Valid email enter karein.").optional().or(z.literal("")), phone: optional, address: optional,
  joiningDate: optional, qualification: optional, specialization: optional, employmentStatus: status,
});

export const staffSchema = z.object({
  employeeCode: required("Employee ID"), firstName: required("First name"), lastName: required("Last name"),
  department: optional, designation: required("Designation"), email: z.string().trim().email("Valid email enter karein.").optional().or(z.literal("")), phone: optional, joiningDate: optional, employmentStatus: status,
});

export const assignmentSchema = z.object({ teacherId: required("Teacher"), assignmentType: z.enum(["class", "section", "subject"]), targetId: required("Assignment"), });
export type PeopleFormState = { error?: string; success?: string; fieldErrors?: Record<string, string[]> };