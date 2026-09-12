"use server";

import { revalidatePath } from "next/cache";
import { requireTimetableContext } from "@/lib/timetable/context";
import { timetableSchema, type TimetableFormState } from "@/lib/timetable/schemas";

function values(formData: FormData) { return Object.fromEntries(formData.entries()); }
export async function saveTimetableEntry(_: TimetableFormState | undefined, formData: FormData): Promise<TimetableFormState> {
  const parsed = timetableSchema.safeParse(values(formData)); if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Timetable form invalid hai." };
  const { supabase, schoolId } = await requireTimetableContext("manage"); const id = String(formData.get("id") ?? "");
  const payload = { academic_session_id: parsed.data.academicSessionId, class_id: parsed.data.classId, section_id: parsed.data.sectionId, subject_id: parsed.data.subjectId, teacher_id: parsed.data.teacherId, room: parsed.data.room || null, day_of_week: parsed.data.dayOfWeek, starts_at: parsed.data.startsAt, ends_at: parsed.data.endsAt, status: parsed.data.status };
  const { error } = id ? await supabase.from("timetable_entries").update(payload).eq("id", id).eq("school_id", schoolId) : await supabase.from("timetable_entries").insert({ school_id: schoolId, ...payload });
  if (error) { if (error.code === "23P01") return { error: "Teacher, section ya room ka same time par conflict hai." }; return { error: "Timetable entry save nahi ho saki." }; }
  revalidatePath("/timetable"); revalidatePath("/timetable/teacher"); revalidatePath("/timetable/class"); return { success: id ? "Timetable update ho gaya." : "Timetable entry add ho gayi." };
}

export async function deleteTimetableEntry(_: TimetableFormState | undefined, formData: FormData): Promise<TimetableFormState> {
  const id = String(formData.get("id") ?? ""); const { supabase, schoolId } = await requireTimetableContext("manage"); const { error } = await supabase.from("timetable_entries").delete().eq("id", id).eq("school_id", schoolId); if (error) return { error: "Timetable entry delete nahi ho saki." }; revalidatePath("/timetable"); return { success: "Entry remove ho gayi." };
}