"use server";

import { revalidatePath } from "next/cache";

import { getAuthErrorMessage } from "@/lib/auth/messages";
import { requireUser } from "@/lib/auth/authorization";
import { requireSetupContext } from "@/lib/setup/context";
import { bootstrapSchoolSchema, classSchema, schoolProfileSchema, sectionSchema, sessionSchema, settingsSchema, subjectSchema, termSchema } from "@/lib/setup/schemas";

export type SetupFormState = { error?: string; success?: string; fieldErrors?: Record<string, string[]> };

function values(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function invalid(error: { flatten: () => { fieldErrors: Record<string, string[]> } }): SetupFormState {
  return { fieldErrors: error.flatten().fieldErrors };
}

export async function bootstrapSchool(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const parsed = bootstrapSchoolSchema.safeParse(values(formData));
  if (!parsed.success) return invalid(parsed.error);
  const current = await requireUser();
  const { data, error } = await current.supabase.rpc("bootstrap_school", {
    school_name: parsed.data.name, school_slug: parsed.data.slug, school_code: parsed.data.code,
    school_email: parsed.data.email || null, school_phone: parsed.data.phone || null,
    school_timezone: parsed.data.timezone, school_currency: parsed.data.currency,
  });
  if (error) return { error: getAuthErrorMessage(error.message) };
  revalidatePath("/setup"); revalidatePath("/dashboard");
  return data ? { success: "School create ho gayi." } : { error: "School create nahi ho saki." };
}

export async function updateSchool(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const parsed = schoolProfileSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error);
  const { supabase, schoolId } = await requireSetupContext();
  const { error } = await supabase.from("schools").update({ name: parsed.data.name, slug: parsed.data.slug, code: parsed.data.code, email: parsed.data.email || null, phone: parsed.data.phone || null, website: formData.get("website")?.toString().trim() || null, address: formData.get("address")?.toString().trim() || null }).eq("id", schoolId);
  if (error) return { error: error.code === "23505" ? "Slug ya code already use ho raha hai." : "School profile update nahi hui." };
  revalidatePath("/setup"); return { success: "School profile save ho gayi." };
}

export async function updateSettings(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const parsed = settingsSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error);
  const { supabase, schoolId } = await requireSetupContext();
  const { error } = await supabase.from("school_settings").update({ timezone: parsed.data.timezone, currency_code: parsed.data.currency, date_format: parsed.data.dateFormat }).eq("school_id", schoolId);
  if (error) return { error: "School settings save nahi hui." };
  revalidatePath("/setup"); return { success: "Settings save ho gayi." };
}

export async function createSession(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const parsed = sessionSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error);
  const { supabase, schoolId } = await requireSetupContext();
  const id = String(formData.get("id") ?? "");
  const payload = { name: parsed.data.name, code: parsed.data.code, starts_on: parsed.data.startsOn, ends_on: parsed.data.endsOn, status: parsed.data.status, is_current: parsed.data.status === "active" };
  const { error } = id ? await supabase.from("academic_sessions").update(payload).eq("id", id).eq("school_id", schoolId) : await supabase.from("academic_sessions").insert({ school_id: schoolId, ...payload });
  if (error) return { error: error.code === "23505" ? "Session code already use ho raha hai." : "Session create nahi ho saki." };
  revalidatePath("/setup"); return { success: "Academic session add ho gayi." };
}

export async function createTerm(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const parsed = termSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error);
  const { supabase, schoolId } = await requireSetupContext();
  const id = String(formData.get("id") ?? "");
  const payload = { academic_session_id: parsed.data.academicSessionId, name: parsed.data.name, code: parsed.data.code, starts_on: parsed.data.startsOn, ends_on: parsed.data.endsOn, status: parsed.data.status, is_current: parsed.data.status === "active" };
  const { error } = id ? await supabase.from("academic_terms").update(payload).eq("id", id).eq("school_id", schoolId) : await supabase.from("academic_terms").insert({ school_id: schoolId, ...payload });
  if (error) return { error: error.code === "23505" ? "Term code already use ho raha hai." : "Term create nahi ho saki." };
  revalidatePath("/setup"); return { success: "Academic term add ho gayi." };
}

export async function createClass(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const parsed = classSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error);
  const { supabase, schoolId } = await requireSetupContext();
  const id = String(formData.get("id") ?? "");
  const payload = { name: parsed.data.name, code: parsed.data.code, description: parsed.data.description || null, status: parsed.data.status };
  const { error } = id ? await supabase.from("classes").update(payload).eq("id", id).eq("school_id", schoolId) : await supabase.from("classes").insert({ school_id: schoolId, ...payload });
  if (error) return { error: error.code === "23505" ? "Class code already use ho raha hai." : "Class create nahi ho saki." };
  revalidatePath("/setup"); return { success: "Class add ho gayi." };
}

export async function createSection(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const parsed = sectionSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error);
  const { supabase, schoolId } = await requireSetupContext();
  const id = String(formData.get("id") ?? "");
  const payload = { class_id: parsed.data.classId, name: parsed.data.name, code: parsed.data.code, capacity: parsed.data.capacity || null, class_teacher_id: parsed.data.classTeacherId || null, status: parsed.data.status };
  const { error } = id ? await supabase.from("sections").update(payload).eq("id", id).eq("school_id", schoolId) : await supabase.from("sections").insert({ school_id: schoolId, ...payload });
  if (error) return { error: error.code === "23505" ? "Section code already use ho raha hai." : "Section create nahi ho saki." };
  revalidatePath("/setup"); return { success: "Section add ho gayi." };
}

export async function createSubject(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const parsed = subjectSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error);
  const { supabase, schoolId } = await requireSetupContext();
  const id = String(formData.get("id") ?? "");
  const payload = { name: parsed.data.name, code: parsed.data.code, subject_type: parsed.data.subjectType, status: parsed.data.status, is_active: parsed.data.status === "active" };
  const { error } = id ? await supabase.from("subjects").update(payload).eq("id", id).eq("school_id", schoolId) : await supabase.from("subjects").insert({ school_id: schoolId, ...payload });
  if (error) return { error: error.code === "23505" ? "Subject code already use ho raha hai." : "Subject create nahi ho sakti." };
  revalidatePath("/setup"); return { success: "Subject add ho gayi." };
}

export async function assignSubject(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const classId = String(formData.get("classId") ?? ""); const subjectId = String(formData.get("subjectId") ?? "");
  if (!classId || !subjectId) return { error: "Class aur subject select karein." };
  const { supabase, schoolId } = await requireSetupContext();
  const { error } = await supabase.from("class_subjects").insert({ school_id: schoolId, class_id: classId, subject_id: subjectId });
  if (error) return { error: error.code === "23505" ? "Ye subject class mein already assigned hai." : "Subject assign nahi ho saka." };
  revalidatePath("/setup"); return { success: "Subject class ko assign ho gaya." };
}

export async function deleteSetupRecord(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const table = String(formData.get("table") ?? ""); const id = String(formData.get("id") ?? "");
  const allowed = { academic_sessions: "id", academic_terms: "id", classes: "id", sections: "id", subjects: "id", class_subjects: "id" } as const;
  if (!(table in allowed) || !id) return { error: "Invalid setup record." };
  const { supabase, schoolId } = await requireSetupContext();
  const { error } = await supabase.from(table as keyof typeof allowed).delete().eq(allowed[table as keyof typeof allowed], id).eq("school_id", schoolId);
  if (error) return { error: "Record delete nahi ho saka. Existing relationships check karein." };
  revalidatePath("/setup"); return { success: "Record delete ho gaya." };
}