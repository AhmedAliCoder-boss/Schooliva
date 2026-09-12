"use server";

import { revalidatePath } from "next/cache";

import { requireStudentContext } from "@/lib/students/context";
import { enrollmentSchema, studentSchema, type StudentFormState } from "@/lib/students/schemas";

function values(formData: FormData) { return Object.fromEntries(formData.entries()); }
function invalid(error: { flatten: () => { fieldErrors: Record<string, string[]> } }): StudentFormState { return { fieldErrors: error.flatten().fieldErrors }; }

async function linkParent(supabase: Awaited<ReturnType<typeof requireStudentContext>>["supabase"], schoolId: string, studentId: string, name: string, relationship: string, phone?: string) {
  if (!name.trim()) return;
  const [firstName, ...lastParts] = name.trim().split(/\s+/);
  const { data: parent, error } = await supabase.from("parents").insert({ school_id: schoolId, first_name: firstName, last_name: lastParts.join(" ") || firstName, relationship, phone: phone || null }).select("id").single();
  if (!error && parent) await supabase.from("student_parents").insert({ school_id: schoolId, student_id: studentId, parent_id: parent.id, relationship, is_primary: relationship === "guardian" });
}

export async function createStudent(_: StudentFormState | undefined, formData: FormData): Promise<StudentFormState> {
  const parsed = studentSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error);
  const { supabase, schoolId } = await requireStudentContext("create");
  const enrollmentValues = enrollmentSchema.safeParse(parsed.data);
  const hasAnyEnrollment = Boolean(parsed.data.academicSessionId || parsed.data.classId || parsed.data.sectionId);
  if (hasAnyEnrollment && !enrollmentValues.success) return invalid(enrollmentValues.error);
  const { data: student, error } = await supabase.from("students").insert({ school_id: schoolId, admission_number: parsed.data.admissionNumber, student_identifier: parsed.data.studentIdentifier || null, first_name: parsed.data.firstName, middle_name: parsed.data.middleName || null, last_name: parsed.data.lastName, date_of_birth: parsed.data.dateOfBirth || null, gender: parsed.data.gender || null, blood_group: parsed.data.bloodGroup || null, nationality: parsed.data.nationality || null, phone: parsed.data.phone || null, email: parsed.data.email || null, address: parsed.data.address || null, admission_date: parsed.data.admissionDate || null, emergency_contact_name: parsed.data.emergencyContactName || null, emergency_contact_phone: parsed.data.emergencyContactPhone || null, medical_notes: parsed.data.medicalNotes || null, previous_school: parsed.data.previousSchool || null, status: parsed.data.status, is_active: parsed.data.status === "active" }).select("id").single();
  if (error || !student) return { error: error?.code === "23505" ? "Admission number ya student ID already use ho raha hai." : "Student create nahi ho saka." };
  await linkParent(supabase, schoolId, student.id, parsed.data.fatherName ?? "", "father");
  await linkParent(supabase, schoolId, student.id, parsed.data.motherName ?? "", "mother");
  await linkParent(supabase, schoolId, student.id, parsed.data.guardianName ?? "", "guardian", parsed.data.guardianPhone);
  if (enrollmentValues.success) await supabase.from("student_enrollments").insert({ school_id: schoolId, student_id: student.id, ...{ academic_session_id: enrollmentValues.data.academicSessionId, academic_term_id: enrollmentValues.data.academicTermId || null, class_id: enrollmentValues.data.classId, section_id: enrollmentValues.data.sectionId, roll_number: enrollmentValues.data.rollNumber || null, enrolled_on: enrollmentValues.data.enrolledOn } });
  revalidatePath("/students"); return { success: "Student add ho gaya.", studentId: student.id };
}

export async function updateStudent(_: StudentFormState | undefined, formData: FormData): Promise<StudentFormState> {
  const parsed = studentSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error);
  const id = String(formData.get("id") ?? ""); if (!id) return { error: "Student ID missing hai." };
  const { supabase, schoolId } = await requireStudentContext("update");
  const { error } = await supabase.from("students").update({ admission_number: parsed.data.admissionNumber, student_identifier: parsed.data.studentIdentifier || null, first_name: parsed.data.firstName, middle_name: parsed.data.middleName || null, last_name: parsed.data.lastName, date_of_birth: parsed.data.dateOfBirth || null, gender: parsed.data.gender || null, blood_group: parsed.data.bloodGroup || null, nationality: parsed.data.nationality || null, phone: parsed.data.phone || null, email: parsed.data.email || null, address: parsed.data.address || null, admission_date: parsed.data.admissionDate || null, emergency_contact_name: parsed.data.emergencyContactName || null, emergency_contact_phone: parsed.data.emergencyContactPhone || null, medical_notes: parsed.data.medicalNotes || null, previous_school: parsed.data.previousSchool || null, status: parsed.data.status, is_active: parsed.data.status === "active", deleted_at: parsed.data.status === "archived" ? new Date().toISOString() : null }).eq("id", id).eq("school_id", schoolId);
  if (error) return { error: error.code === "23505" ? "Admission number ya student ID already use ho raha hai." : "Student update nahi ho saka." };
  revalidatePath("/students"); revalidatePath(`/students/${id}`); return { success: "Student update ho gaya." };
}

export async function archiveStudent(_: StudentFormState | undefined, formData: FormData): Promise<StudentFormState> {
  const id = String(formData.get("id") ?? ""); const { supabase, schoolId } = await requireStudentContext("delete");
  const { error } = await supabase.from("students").update({ status: "archived", is_active: false, deleted_at: new Date().toISOString() }).eq("id", id).eq("school_id", schoolId);
  if (error) return { error: "Student archive nahi ho saka." };
  revalidatePath("/students"); revalidatePath(`/students/${id}`); return { success: "Student archive ho gaya." };
}

export async function createEnrollment(_: StudentFormState | undefined, formData: FormData): Promise<StudentFormState> {
  const parsed = enrollmentSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error);
  const studentId = String(formData.get("studentId") ?? ""); const { supabase, schoolId } = await requireStudentContext("update");
  const { error } = await supabase.from("student_enrollments").insert({ school_id: schoolId, student_id: studentId, academic_session_id: parsed.data.academicSessionId, academic_term_id: parsed.data.academicTermId || null, class_id: parsed.data.classId, section_id: parsed.data.sectionId, roll_number: parsed.data.rollNumber || null, enrolled_on: parsed.data.enrolledOn });
  if (error) return { error: error.code === "23505" ? "Student ka is session mein enrollment already hai." : "Enrollment create nahi ho saki." };
  revalidatePath(`/students/${studentId}`); return { success: "New enrollment history mein add ho gayi." };
}

export async function addStudentDocument(_: StudentFormState | undefined, formData: FormData): Promise<StudentFormState> {
  const studentId = String(formData.get("studentId") ?? "");
  const documentType = String(formData.get("documentType") ?? "").trim();
  const documentName = String(formData.get("documentName") ?? "").trim();
  if (!studentId || !documentType || !documentName) return { error: "Document type aur name required hai." };
  const { supabase, schoolId } = await requireStudentContext("update");
  const { error } = await supabase.from("student_documents").insert({ school_id: schoolId, student_id: studentId, document_type: documentType, document_name: documentName, metadata: { source: "student_profile" } });
  if (error) return { error: "Document metadata save nahi ho saki." };
  revalidatePath(`/students/${studentId}`); return { success: "Document metadata add ho gayi." };
}