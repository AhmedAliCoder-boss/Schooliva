"use server";

import { revalidatePath } from "next/cache";

import { requireStudentContext } from "@/lib/students/context";
import { canEditStudentProfile } from "@/lib/students/permissions";
import { studentSchema, type StudentFormState } from "@/lib/students/schemas";

function values(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function invalid(error: { flatten: () => { fieldErrors: Record<string, string[]> } }): StudentFormState {
  return { fieldErrors: error.flatten().fieldErrors };
}

export async function updateStudent(_: StudentFormState | undefined, formData: FormData): Promise<StudentFormState> {
  const parsed = studentSchema.safeParse(values(formData));
  if (!parsed.success) return invalid(parsed.error);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Student ID missing hai." };
  const { supabase, schoolId, user } = await requireStudentContext("update");
  if (!await canEditStudentProfile(supabase, schoolId, user.id)) {
    return { error: "Sirf school admin ya principal student profile edit kar sakta hai." };
  }
  const { error } = await supabase.from("students").update({
    first_name: parsed.data.firstName,
    middle_name: parsed.data.middleName || null,
    last_name: parsed.data.lastName,
    date_of_birth: parsed.data.dateOfBirth || null,
    gender: parsed.data.gender || null,
    blood_group: parsed.data.bloodGroup || null,
    nationality: parsed.data.nationality || null,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    address: parsed.data.address || null,
    admission_date: parsed.data.admissionDate || null,
    emergency_contact_name: parsed.data.emergencyContactName || null,
    emergency_contact_phone: parsed.data.emergencyContactPhone || null,
    emergency_contact_relationship: parsed.data.emergencyContactRelationship || null,
    medical_notes: parsed.data.medicalNotes || null,
    previous_school: parsed.data.previousSchool || null,
    status: parsed.data.status,
    is_active: parsed.data.status === "active",
    deleted_at: parsed.data.status === "archived" ? new Date().toISOString() : null,
  }).eq("id", id).eq("school_id", schoolId);
  if (error) return { error: error.code === "23505" ? "School-specific code already use ho raha hai." : "Student update nahi ho saka." };
  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  return { success: "Student update ho gaya." };
}

export async function archiveStudent(_: StudentFormState | undefined, formData: FormData): Promise<StudentFormState> {
  const id = String(formData.get("id") ?? "");
  const { supabase, schoolId, user } = await requireStudentContext("delete");
  if (!await canEditStudentProfile(supabase, schoolId, user.id)) {
    return { error: "Sirf school admin ya principal student archive kar sakta hai." };
  }
  const { error } = await supabase.from("students").update({ status: "archived", is_active: false, deleted_at: new Date().toISOString() }).eq("id", id).eq("school_id", schoolId);
  if (error) return { error: "Student archive nahi ho saka." };
  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  return { success: "Student archive ho gaya." };
}

export async function addStudentDocument(_: StudentFormState | undefined, formData: FormData): Promise<StudentFormState> {
  const studentId = String(formData.get("studentId") ?? "");
  const documentType = String(formData.get("documentType") ?? "").trim();
  const documentName = String(formData.get("documentName") ?? "").trim();
  if (!studentId || !documentType || !documentName) return { error: "Document type aur name required hai." };
  const { supabase, schoolId, user } = await requireStudentContext("update");
  if (!await canEditStudentProfile(supabase, schoolId, user.id)) {
    return { error: "Sirf school admin ya principal student documents manage kar sakta hai." };
  }
  const { error } = await supabase.from("student_documents").insert({ school_id: schoolId, student_id: studentId, document_type: documentType, document_name: documentName, metadata: { source: "student_profile" } });
  if (error) return { error: "Document metadata save nahi ho saki." };
  revalidatePath(`/students/${studentId}`);
  return { success: "Document metadata add ho gayi." };
}