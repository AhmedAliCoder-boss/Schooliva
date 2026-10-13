"use server";

import { revalidatePath } from "next/cache";
import { requireTimetableContext } from "@/lib/timetable/context";
import { timetablePeriodsSchema, timetableSchema, timetableWorkingDaysSchema, type TimetableFormState } from "@/lib/timetable/schemas";
import { defaultTimetableWorkingDays } from "@/lib/timetable/working-days";

export async function saveTimetableEntry(_: TimetableFormState | undefined, formData: FormData): Promise<TimetableFormState> {
  const parsed = timetableSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    academicSessionId: String(formData.get("academicSessionId") ?? ""),
    classId: String(formData.get("classId") ?? ""),
    sectionId: String(formData.get("sectionId") ?? ""),
    subjectId: String(formData.get("subjectId") ?? ""),
    teacherId: String(formData.get("teacherId") ?? ""),
    periodNumber: String(formData.get("periodNumber") ?? ""),
    room: String(formData.get("room") ?? ""),
    dayOfWeek: String(formData.get("dayOfWeek") ?? ""),
    status: String(formData.get("status") ?? "active"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Timetable form invalid hai." };
  }

  const { supabase, schoolId } = await requireTimetableContext("manage");
  const [
    { data: session, error: sessionError },
    { data: section, error: sectionError },
    { data: subjectMapping, error: subjectMappingError },
    { data: teacher, error: teacherError },
    { data: teacherAssignment, error: teacherAssignmentError },
  ] = await Promise.all([
    supabase.from("academic_sessions").select("id").eq("id", parsed.data.academicSessionId).eq("school_id", schoolId).maybeSingle(),
    supabase.from("sections").select("id").eq("id", parsed.data.sectionId).eq("class_id", parsed.data.classId).eq("school_id", schoolId).eq("status", "active").maybeSingle(),
    supabase.from("class_subjects").select("id").eq("school_id", schoolId)
      .eq("class_id", parsed.data.classId).eq("subject_id", parsed.data.subjectId).maybeSingle(),
    supabase.from("teachers").select("id").eq("id", parsed.data.teacherId).eq("school_id", schoolId)
      .eq("employment_status", "active").eq("is_active", true).is("deleted_at", null).maybeSingle(),
    supabase.from("teacher_assignments").select("id")
      .eq("school_id", schoolId)
      .eq("academic_session_id", parsed.data.academicSessionId)
      .eq("teacher_id", parsed.data.teacherId)
      .eq("subject_id", parsed.data.subjectId)
      .eq("assignment_type", "subject")
      .or(`class_id.is.null,class_id.eq.${parsed.data.classId}`)
      .limit(1)
      .maybeSingle(),
  ]);
  if (sessionError || sectionError || subjectMappingError || teacherError || teacherAssignmentError) {
    console.error("Timetable class, subject, session, or teacher assignment could not be verified.", sessionError ?? sectionError ?? subjectMappingError ?? teacherError ?? teacherAssignmentError);
    return { error: "The selected class subject and assigned teacher could not be verified. Refresh and try again." };
  }
  if (!session || !section || !subjectMapping) {
    return { error: "Choose a valid academic session, class, section, and school subject assigned to that class." };
  }
  if (!teacher || !teacherAssignment) {
    return { error: "Choose an active teacher assigned to this subject for the selected class and academic session." };
  }
  const { data: settings, error: settingsError } = await supabase.from("school_settings")
    .select("timetable_working_days").eq("school_id", schoolId).maybeSingle();
  if (settingsError) {
    console.error("School timetable working days could not be loaded.", settingsError);
    return { error: "School working days could not be checked. Refresh and try again." };
  }
  const workingDays = settings?.timetable_working_days ?? defaultTimetableWorkingDays;
  if (parsed.data.status === "active" && !workingDays.includes(parsed.data.dayOfWeek)) {
    return { error: "Lessons cannot be scheduled on a school holiday. Change the working-day settings first." };
  }
  const { data: period, error: periodError } = await supabase.from("timetable_periods")
    .select("starts_at,ends_at").eq("school_id", schoolId)
    .eq("period_number", parsed.data.periodNumber).eq("is_active", true).maybeSingle();
  if (periodError) {
    console.error("Timetable period could not be loaded.", periodError);
    return { error: "The selected period could not be loaded. Refresh and try again." };
  }
  if (!period) return { error: "Select an active school period before assigning a lesson." };
  const id = parsed.data.id || null;
  const payload = {
    academic_session_id: parsed.data.academicSessionId,
    class_id: parsed.data.classId,
    section_id: parsed.data.sectionId,
    subject_id: parsed.data.subjectId,
    teacher_id: parsed.data.teacherId,
    period_number: parsed.data.periodNumber,
    room: parsed.data.room || null,
    day_of_week: parsed.data.dayOfWeek,
    starts_at: period.starts_at,
    ends_at: period.ends_at,
    status: parsed.data.status,
  };
  const { data, error } = id
    ? await supabase.from("timetable_entries").update(payload).eq("id", id).eq("school_id", schoolId).select("id").maybeSingle()
    : await supabase.from("timetable_entries").insert({ school_id: schoolId, ...payload }).select("id").maybeSingle();

  if (error) {
    if (error.code === "23P01") {
      const conflict = error.message.toLowerCase();
      if (conflict.includes("teacher")) return { error: "This teacher already has a class at that time." };
      if (conflict.includes("section")) return { error: "This class section already has a lesson at that time." };
      if (conflict.includes("room")) return { error: "This room is already in use at that time." };
      return { error: "The selected timetable entry conflicts with another lesson." };
    }
    console.error("Timetable entry could not be saved.", error);
    return { error: "Timetable entry could not be saved. Check the selected class, section, subject, teacher, and academic session." };
  }
  if (!data) {
    return { error: "No timetable entry was changed. It may have been removed or may belong to another school." };
  }

  revalidateTimetableViews();
  return { success: id ? "Timetable entry updated." : "Timetable entry added." };
}

export async function deleteTimetableEntry(_: TimetableFormState | undefined, formData: FormData): Promise<TimetableFormState> {
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { error: "Choose a valid timetable entry." };
  }
  const { supabase, schoolId } = await requireTimetableContext("manage");
  const { data, error } = await supabase.from("timetable_entries").delete()
    .eq("id", id).eq("school_id", schoolId).select("id").maybeSingle();
  if (error) {
    console.error("Timetable entry could not be removed.", error);
    return { error: "Timetable entry could not be removed. Refresh and try again." };
  }
  if (!data) return { error: "This timetable entry was already removed or is not part of this school." };
  revalidateTimetableViews();
  return { success: "Timetable entry removed." };
}

export async function saveTimetablePeriods(_: TimetableFormState | undefined, formData: FormData): Promise<TimetableFormState> {
  const names = formData.getAll("periodName");
  const starts = formData.getAll("startsAt");
  const ends = formData.getAll("endsAt");
  if (names.length !== starts.length || names.length !== ends.length) {
    return { error: "Every period must include a name, start time, and end time." };
  }
  const parsed = timetablePeriodsSchema.safeParse(names.map((name, index) => ({
    name: String(name),
    startsAt: String(starts[index] ?? ""),
    endsAt: String(ends[index] ?? ""),
  })));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Period configuration is invalid." };

  const { supabase, schoolId } = await requireTimetableContext("manage");
  const { error } = await supabase.rpc("save_school_timetable_periods", {
    target_school_id: schoolId,
    target_periods: parsed.data.map((period, index) => ({
      periodNumber: index + 1,
      name: period.name,
      startsAt: period.startsAt,
      endsAt: period.endsAt,
    })),
  });
  if (error) {
    console.error("School timetable periods could not be saved.", error);
    return { error: error.message.includes("Remove or move lessons")
      ? "Move or remove lessons from periods above the new daily limit before reducing the number of periods."
      : error.message.includes("Period times cannot overlap")
        ? "Period times cannot overlap."
        : "Period configuration could not be saved. Check the times and try again." };
  }
  revalidateTimetableViews();
  return { success: "Daily periods saved." };
}

export async function saveTimetableWorkingDays(_: TimetableFormState | undefined, formData: FormData): Promise<TimetableFormState> {
  const parsed = timetableWorkingDaysSchema.safeParse(formData.getAll("workingDay"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Working days are invalid." };

  const { supabase, schoolId } = await requireTimetableContext("manage");
  const { error } = await supabase.rpc("save_school_timetable_working_days", {
    target_school_id: schoolId,
    target_working_days: [...new Set(parsed.data)].sort((left, right) => left - right),
  });
  if (error) {
    console.error("School timetable working days could not be saved.", error);
    if (error.message.includes("Move or remove active lessons")) {
      return { error: "Move or remove active lessons scheduled on the days you are closing, then save the working days again." };
    }
    if (error.message.includes("Not authorized")) {
      return { error: "You do not have permission to change this school's working days." };
    }
    return { error: "Working days could not be saved. Refresh and try again." };
  }
  revalidateTimetableViews();
  revalidatePath("/timetable/print");
  return { success: "School working days saved." };
}

function revalidateTimetableViews() {
  revalidatePath("/timetable");
  revalidatePath("/timetable/teacher");
  revalidatePath("/timetable/class");
}