"use server";

import { revalidatePath } from "next/cache";

import { requirePeopleAttendanceContext } from "@/lib/people/attendance-context";
import { peopleAttendanceSubmissionSchema, type PeopleAttendanceFormState } from "@/lib/people/attendance-schemas";

export async function submitPeopleAttendance(_: PeopleAttendanceFormState | undefined, formData: FormData): Promise<PeopleAttendanceFormState> {
  let records: unknown;
  try {
    records = JSON.parse(String(formData.get("records") ?? "[]"));
  } catch {
    return { error: "Attendance records invalid hain." };
  }
  const parsed = peopleAttendanceSubmissionSchema.safeParse({ attendanceDate: formData.get("attendanceDate"), records });
  if (!parsed.success) return { error: `Attendance form complete nahi hai: ${parsed.error.issues[0]?.path.join(".") || "records"}.` };
  const { supabase, schoolId, user } = await requirePeopleAttendanceContext("manage");
  const teacherIds = parsed.data.records.filter((record) => record.personType === "teacher").map((record) => record.personId);
  const staffIds = parsed.data.records.filter((record) => record.personType === "staff").map((record) => record.personId);
  const [{ data: teachers }, { data: staff }] = await Promise.all([
    teacherIds.length ? supabase.from("teachers").select("id").eq("school_id", schoolId).in("id", teacherIds) : Promise.resolve({ data: [] }),
    staffIds.length ? supabase.from("staff").select("id").eq("school_id", schoolId).in("id", staffIds) : Promise.resolve({ data: [] }),
  ]);
  const validTeacherIds = new Set((teachers ?? []).map((person) => person.id));
  const validStaffIds = new Set((staff ?? []).map((person) => person.id));
  if (parsed.data.records.some((record) => record.personType === "teacher" ? !validTeacherIds.has(record.personId) : !validStaffIds.has(record.personId))) return { error: "People record school se match nahi karta." };
  const rows = parsed.data.records.map((record) => ({ school_id: schoolId, teacher_id: record.personType === "teacher" ? record.personId : null, staff_id: record.personType === "staff" ? record.personId : null, attendance_date: parsed.data.attendanceDate, status: record.status, remarks: record.remarks || null, marked_by: user.id }));
  const { data: existing } = await supabase.from("people_attendance").select("id,teacher_id,staff_id").eq("school_id", schoolId).eq("attendance_date", parsed.data.attendanceDate);
  const existingByPerson = new Map((existing ?? []).map((record) => [`${record.teacher_id ? "teacher" : "staff"}:${record.teacher_id ?? record.staff_id}`, record.id]));
  const saveResults = await Promise.all(rows.map(async (row) => {
    const personKey = `${row.teacher_id ? "teacher" : "staff"}:${row.teacher_id ?? row.staff_id}`;
    const existingId = existingByPerson.get(personKey);
    return existingId
      ? supabase.from("people_attendance").update(row).eq("id", existingId).eq("school_id", schoolId)
      : supabase.from("people_attendance").insert(row);
  }));
  if (saveResults.some((result) => result.error)) return { error: "People attendance save nahi ho saki." };
  revalidatePath("/people-attendance");
  return { success: `${rows.length} teachers/staff ki attendance save ho gayi.` };
}