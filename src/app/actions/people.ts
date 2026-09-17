"use server";

import { revalidatePath } from "next/cache";

import { requirePeopleContext } from "@/lib/people/context";
import { assignmentSchema, staffSchema, teacherSchema, type PeopleFormState } from "@/lib/people/schemas";

function values(formData: FormData) { return Object.fromEntries(formData.entries()); }
function invalid(error: { flatten: () => { fieldErrors: Record<string, string[]> } }): PeopleFormState { return { fieldErrors: error.flatten().fieldErrors }; }

export async function saveTeacher(_: PeopleFormState | undefined, formData: FormData): Promise<PeopleFormState> {
  const parsed = teacherSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error);
  const { supabase, schoolId } = await requirePeopleContext("teachers", "manage"); const id = String(formData.get("id") ?? "");
  const payload = { employee_code: parsed.data.employeeCode, first_name: parsed.data.firstName, last_name: parsed.data.lastName, gender: parsed.data.gender || null, date_of_birth: parsed.data.dateOfBirth || null, email: parsed.data.email || null, phone: parsed.data.phone || null, address: parsed.data.address || null, joining_date: parsed.data.joiningDate || null, qualification: parsed.data.qualification || null, specialization: parsed.data.specialization || null, employment_status: parsed.data.employmentStatus, is_active: parsed.data.employmentStatus === "active", deleted_at: parsed.data.employmentStatus === "terminated" ? new Date().toISOString() : null };
  const { error } = id ? await supabase.from("teachers").update(payload).eq("id", id).eq("school_id", schoolId) : await supabase.from("teachers").insert({ school_id: schoolId, ...payload });
  if (error) return { error: error.code === "23505" ? "Employee ID already use ho raha hai." : "Teacher save nahi ho saka." };
  revalidatePath("/teachers"); if (id) revalidatePath(`/teachers/${id}`); return { success: id ? "Teacher update ho gaya." : "Teacher add ho gaya." };
}

export async function saveStaff(_: PeopleFormState | undefined, formData: FormData): Promise<PeopleFormState> {
  const parsed = staffSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error);
  const { supabase, schoolId } = await requirePeopleContext("staff", "manage"); const id = String(formData.get("id") ?? "");
  const payload = { employee_code: parsed.data.employeeCode, first_name: parsed.data.firstName, last_name: parsed.data.lastName, department: parsed.data.department || null, designation: parsed.data.designation, email: parsed.data.email || null, phone: parsed.data.phone || null, joining_date: parsed.data.joiningDate || null, employment_status: parsed.data.employmentStatus, is_active: parsed.data.employmentStatus === "active", deleted_at: parsed.data.employmentStatus === "terminated" ? new Date().toISOString() : null };
  const { error } = id ? await supabase.from("staff").update(payload).eq("id", id).eq("school_id", schoolId) : await supabase.from("staff").insert({ school_id: schoolId, ...payload });
  if (error) return { error: error.code === "23505" ? "Employee ID already use ho raha hai." : "Staff save nahi ho saka." };
  revalidatePath("/staff"); if (id) revalidatePath(`/staff/${id}`); return { success: id ? "Staff update ho gaya." : "Staff add ho gaya." };
}

export async function addTeacherAssignment(_: PeopleFormState | undefined, formData: FormData): Promise<PeopleFormState> {
  const assignmentType = String(formData.get("assignmentType") ?? "");
  const targetId = assignmentType === "class" ? String(formData.get("classId") ?? "") : assignmentType === "section" ? String(formData.get("sectionId") ?? "") : String(formData.get("subjectId") ?? "");
  const parsed = assignmentSchema.safeParse({ teacherId: formData.get("teacherId"), assignmentType, targetId }); if (!parsed.success) return invalid(parsed.error);
  const { supabase, schoolId } = await requirePeopleContext("teachers", "manage");
  const target = parsed.data.assignmentType === "class" ? { class_id: parsed.data.targetId } : parsed.data.assignmentType === "section" ? { section_id: parsed.data.targetId } : { subject_id: parsed.data.targetId };
  const { error } = await supabase.from("teacher_assignments").insert({ school_id: schoolId, teacher_id: parsed.data.teacherId, assignment_type: parsed.data.assignmentType, ...target });
  if (error) return { error: error.code === "23505" ? "Ye assignment already added hai." : "Assignment save nahi ho saki." };
  revalidatePath(`/teachers/${parsed.data.teacherId}`); return { success: "Teacher assignment add ho gayi." };
}

export async function deleteTeacherAssignment(_: PeopleFormState | undefined, formData: FormData): Promise<PeopleFormState> {
  const id = String(formData.get("id") ?? ""); const teacherId = String(formData.get("teacherId") ?? ""); const { supabase, schoolId } = await requirePeopleContext("teachers", "manage");
  const { error } = await supabase.from("teacher_assignments").delete().eq("id", id).eq("school_id", schoolId);
  if (error) return { error: "Assignment remove nahi ho saki." }; revalidatePath(`/teachers/${teacherId}`); return { success: "Assignment remove ho gayi." };
}