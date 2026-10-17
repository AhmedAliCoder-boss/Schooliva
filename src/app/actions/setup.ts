"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/authorization";
import { requireSetupContext } from "@/lib/setup/context";
import { bootstrapSchoolSchema, classSchema, schoolProfileSchema, sectionSchema, sessionSchema, settingsSchema, subjectSchema, termSchema } from "@/lib/setup/schemas";

export type SetupFormState = { error?: string; success?: string; fieldErrors?: Record<string, string[]>; values?: Record<string, string> };

function values(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function submittedValues(formData: FormData) {
  return Object.fromEntries([...formData.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function invalid(error: { flatten: () => { fieldErrors: Record<string, string[]> } }, formData: FormData): SetupFormState {
  return { fieldErrors: error.flatten().fieldErrors, values: submittedValues(formData) };
}

export async function bootstrapSchool(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const parsed = bootstrapSchoolSchema.safeParse(values(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const current = await requireUser();
  const { data, error } = await current.supabase.rpc("bootstrap_school", {
    school_name: parsed.data.name, school_slug: parsed.data.slug, school_code: parsed.data.code,
    school_email: parsed.data.email || null, school_phone: parsed.data.phone || null,
    school_timezone: parsed.data.timezone, school_currency: parsed.data.currency,
    school_short_name: parsed.data.shortName, school_campus: parsed.data.campus, school_type: parsed.data.schoolType,
    school_board: parsed.data.board, school_medium: parsed.data.medium, school_address: parsed.data.address,
    school_city: parsed.data.city, school_province: parsed.data.province, school_country: parsed.data.country,
    school_principal: parsed.data.principal, school_established_year: parsed.data.establishedYear,
    school_academic_year: parsed.data.academicYear, school_website: parsed.data.website || null,
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (error.code === "23505" || message.includes("duplicate key")) return { error: "A school with this slug or code already exists." };
    if (message.includes("function public.bootstrap_school") || message.includes("does not exist")) return { error: "The school setup migration has not been applied to Supabase. Apply the migration and try again." };
    if (message.includes("authentication required")) return { error: "Your session has expired. Sign in again." };
    return { error: "The school could not be created. Check the form and try again." };
  }
  revalidatePath("/setup"); revalidatePath("/dashboard");
  return data ? { success: "School created." } : { error: "The school could not be created." };
}

export async function updateSchool(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const parsed = schoolProfileSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error, formData);
  const { supabase, schoolId } = await requireSetupContext();
  const { error } = await supabase.from("schools").update({
    name: parsed.data.name,
    short_name: parsed.data.shortName || null,
    slug: parsed.data.slug,
    code: parsed.data.code,
    school_type: parsed.data.schoolType || null,
    campus: parsed.data.campus || null,
    board: parsed.data.board || null,
    medium: parsed.data.medium || null,
    principal: parsed.data.principal || null,
    established_year: parsed.data.establishedYear ?? null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    website: parsed.data.website || null,
    address: parsed.data.address || null,
    city: parsed.data.city || null,
    state: parsed.data.state || null,
    country: parsed.data.country || null,
  }).eq("id", schoolId);
  if (error) return { error: error.code === "23505" ? "A school with this slug or code already exists." : "The school profile could not be updated." };
  revalidatePath("/setup"); return { success: "School profile saved." };
}

export async function updateSettings(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const parsed = settingsSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error, formData);
  const { supabase, schoolId } = await requireSetupContext();
  const { error } = await supabase.from("school_settings").update({
    timezone: parsed.data.timezone,
    currency_code: parsed.data.currency,
    date_format: parsed.data.dateFormat,
    academic_year: parsed.data.academicYear || null,
  }).eq("school_id", schoolId);
  if (error) return { error: "School settings could not be saved." };
  revalidatePath("/setup"); return { success: "Settings saved." };
}

export async function createSession(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const parsed = sessionSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error, formData);
  const { supabase, schoolId } = await requireSetupContext();
  const id = String(formData.get("id") ?? "");
  const payload = { name: parsed.data.name, code: parsed.data.code, starts_on: parsed.data.startsOn, ends_on: parsed.data.endsOn, status: parsed.data.status, is_current: parsed.data.status === "active" };
  const { error } = id ? await supabase.from("academic_sessions").update(payload).eq("id", id).eq("school_id", schoolId) : await supabase.from("academic_sessions").insert({ school_id: schoolId, ...payload });
  if (error) return { error: error.code === "23505" ? "A session with this code already exists." : "The academic session could not be created." };
  revalidatePath("/setup"); return { success: "Academic session added." };
}

export async function createTerm(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const parsed = termSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error, formData);
  const { supabase, schoolId } = await requireSetupContext();
  const id = String(formData.get("id") ?? "");
  const payload = { academic_session_id: parsed.data.academicSessionId, name: parsed.data.name, code: parsed.data.code, starts_on: parsed.data.startsOn, ends_on: parsed.data.endsOn, status: parsed.data.status, is_current: parsed.data.status === "active" };
  const { error } = id ? await supabase.from("academic_terms").update(payload).eq("id", id).eq("school_id", schoolId) : await supabase.from("academic_terms").insert({ school_id: schoolId, ...payload });
  if (error) return { error: error.code === "23505" ? "A term with this code already exists." : "The academic term could not be created." };
  revalidatePath("/setup"); return { success: "Academic term added." };
}

export async function createClass(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const parsed = classSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error, formData);
  const { supabase, schoolId } = await requireSetupContext();
  const id = String(formData.get("id") ?? "");
  const payload = { name: parsed.data.name, code: parsed.data.code, description: parsed.data.description || null, status: parsed.data.status };
  const { error } = id ? await supabase.from("classes").update(payload).eq("id", id).eq("school_id", schoolId) : await supabase.from("classes").insert({ school_id: schoolId, ...payload });
  if (error) return { error: error.code === "23505" ? "A class with this code already exists." : "The class could not be created." };
  revalidatePath("/setup"); return { success: "Class added." };
}

export async function createSection(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const parsed = sectionSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error, formData);
  const { supabase, schoolId } = await requireSetupContext();
  const id = String(formData.get("id") ?? "");
  const payload = { class_id: parsed.data.classId, name: parsed.data.name, code: parsed.data.code, capacity: parsed.data.capacity || null, class_teacher_id: parsed.data.classTeacherId || null, status: parsed.data.status };
  const { error } = id ? await supabase.from("sections").update(payload).eq("id", id).eq("school_id", schoolId) : await supabase.from("sections").insert({ school_id: schoolId, ...payload });
  if (error) return { error: error.code === "23505" ? "A section with this code already exists." : "The section could not be created." };
  revalidatePath("/setup"); return { success: "Section added." };
}

export async function createSubject(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const parsed = subjectSchema.safeParse(values(formData)); if (!parsed.success) return invalid(parsed.error, formData);
  const { supabase, schoolId } = await requireSetupContext();
  const id = String(formData.get("id") ?? "");
  const payload = { name: parsed.data.name, code: parsed.data.code, subject_type: parsed.data.subjectType, status: parsed.data.status, is_active: parsed.data.status === "active" };
  const { error } = id ? await supabase.from("subjects").update(payload).eq("id", id).eq("school_id", schoolId) : await supabase.from("subjects").insert({ school_id: schoolId, ...payload });
  if (error) return { error: error.code === "23505" ? "A subject with this code already exists." : "The subject could not be created." };
  revalidatePath("/setup"); return { success: "Subject added." };
}

export async function assignSubject(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const classId = String(formData.get("classId") ?? ""); const subjectId = String(formData.get("subjectId") ?? "");
  if (!classId || !subjectId) return { error: "Select a class and subject." };
  const { supabase, schoolId } = await requireSetupContext();
  const { error } = await supabase.from("class_subjects").insert({ school_id: schoolId, class_id: classId, subject_id: subjectId });
  if (error) return { error: error.code === "23505" ? "This subject is already assigned to the class." : "The subject could not be assigned." };
  revalidatePath("/setup"); return { success: "Subject assigned to the class." };
}

export async function deleteSetupRecord(_: SetupFormState | undefined, formData: FormData): Promise<SetupFormState> {
  const table = String(formData.get("table") ?? ""); const id = String(formData.get("id") ?? "");
  const allowed = { academic_sessions: "id", academic_terms: "id", classes: "id", sections: "id", subjects: "id", class_subjects: "id" } as const;
  if (!(table in allowed) || !id) return { error: "Invalid setup record." };
  const { supabase, schoolId } = await requireSetupContext();
  const { error } = await supabase.from(table as keyof typeof allowed).delete().eq(allowed[table as keyof typeof allowed], id).eq("school_id", schoolId);
  if (error) return { error: "The record could not be deleted. Check its existing relationships." };
  revalidatePath("/setup"); return { success: "Record deleted." };
}