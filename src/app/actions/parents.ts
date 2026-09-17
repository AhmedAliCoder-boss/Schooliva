"use server";

import { revalidatePath } from "next/cache";

import { requireParentContext } from "@/lib/parents/context";
import { parentSchema, relationshipSchema, type ParentFormState } from "@/lib/parents/schemas";
import { createClient } from "@/lib/supabase/server";

function values(formData: FormData) { return Object.fromEntries(formData.entries()); }
function invalid(error: { flatten: () => { fieldErrors: Record<string, string[]> } }): ParentFormState { return { fieldErrors: error.flatten().fieldErrors }; }

export async function saveParent(_: ParentFormState | undefined, formData: FormData): Promise<ParentFormState> {
  const parsed = parentSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error);
  const id = String(formData.get("id") ?? ""); const { supabase, schoolId } = await requireParentContext(id ? "update" : "create");
  const payload = { first_name: parsed.data.firstName, last_name: parsed.data.lastName, relationship: parsed.data.relationship || null, phone: parsed.data.phone || null, email: parsed.data.email || null, address: parsed.data.address || null, emergency_contact_name: parsed.data.emergencyContactName || null, emergency_contact_phone: parsed.data.emergencyContactPhone || null, profile_id: parsed.data.profileId || null };
  const { error } = id ? await supabase.from("parents").update(payload).eq("id", id).eq("school_id", schoolId) : await supabase.from("parents").insert({ school_id: schoolId, ...payload });
  if (error) return { error: error.code === "23505" ? "Parent profile already linked hai." : "Parent save nahi ho saka." };
  revalidatePath("/parents"); if (id) revalidatePath(`/parents/${id}`); return { success: id ? "Parent update ho gaya." : "Parent add ho gaya." };
}

export async function addRelationship(_: ParentFormState | undefined, formData: FormData): Promise<ParentFormState> {
  const parsed = relationshipSchema.safeParse({ studentId: formData.get("studentId"), relationship: formData.get("relationship"), isPrimary: formData.get("isPrimary") === "on" }); if (!parsed.success) return invalid(parsed.error);
  const parentId = String(formData.get("parentId") ?? ""); const { supabase, schoolId } = await requireParentContext("update");
  const { error } = await supabase.from("student_parents").insert({ school_id: schoolId, student_id: parsed.data.studentId, parent_id: parentId, relationship: parsed.data.relationship, is_primary: parsed.data.isPrimary });
  if (error) return { error: error.code === "23505" ? "Ye relationship already exist karti hai ya primary guardian conflict hai." : "Relationship add nahi ho saki." };
  revalidatePath(`/parents/${parentId}`); return { success: "Student relationship add ho gayi." };
}

export async function removeRelationship(_: ParentFormState | undefined, formData: FormData): Promise<ParentFormState> {
  const parentId = String(formData.get("parentId") ?? ""); const studentId = String(formData.get("studentId") ?? ""); const { supabase, schoolId } = await requireParentContext("update");
  const { error } = await supabase.from("student_parents").delete().eq("parent_id", parentId).eq("student_id", studentId).eq("school_id", schoolId);
  if (error) return { error: "Relationship remove nahi ho saki." }; revalidatePath(`/parents/${parentId}`); return { success: "Relationship remove ho gayi." };
}

export async function updateOwnParent(_: ParentFormState | undefined, formData: FormData): Promise<ParentFormState> {
  const parsed = parentSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return { error: "Session expire ho gayi." };
  const { error } = await supabase.from("parents").update({ first_name: parsed.data.firstName, last_name: parsed.data.lastName, phone: parsed.data.phone || null, email: parsed.data.email || null, address: parsed.data.address || null, emergency_contact_name: parsed.data.emergencyContactName || null, emergency_contact_phone: parsed.data.emergencyContactPhone || null }).eq("profile_id", user.id);
  if (error) return { error: "Parent profile update nahi ho saki." }; revalidatePath("/parent"); return { success: "Parent profile update ho gayi." };
}