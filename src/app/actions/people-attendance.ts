"use server";

import { revalidatePath } from "next/cache";

import { requirePeopleAttendanceContext } from "@/lib/people/attendance-context";
import { peopleAttendanceSubmissionSchema, type PeopleAttendanceFormState } from "@/lib/people/attendance-schemas";

export async function submitPeopleAttendance(_: PeopleAttendanceFormState | undefined, formData: FormData): Promise<PeopleAttendanceFormState> {
  let records: unknown;
  try {
    records = JSON.parse(String(formData.get("records") ?? "[]"));
  } catch {
    return { error: "Attendance records are invalid." };
  }
  const parsed = peopleAttendanceSubmissionSchema.safeParse({ attendanceDate: formData.get("attendanceDate"), records });
  if (!parsed.success) return { error: `Complete the attendance form: ${parsed.error.issues[0]?.path.join(".") || "records"}.` };
  const { supabase, schoolId, user } = await requirePeopleAttendanceContext("manage");
  const teacherIds = parsed.data.records.filter((record) => record.personType === "teacher").map((record) => record.personId);
  const staffIds = parsed.data.records.filter((record) => record.personType === "staff").map((record) => record.personId);
  const [{ data: teachers, error: teachersError }, { data: staff, error: staffError }, { data: approvedLeaves, error: leavesError }] = await Promise.all([
    teacherIds.length ? supabase.from("teachers").select("id").eq("school_id", schoolId).in("id", teacherIds) : Promise.resolve({ data: [], error: null }),
    staffIds.length ? supabase.from("staff").select("id").eq("school_id", schoolId).in("id", staffIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("leave_requests").select("teacher_id,staff_id").eq("school_id", schoolId).eq("status", "approved").lte("start_date", parsed.data.attendanceDate).gte("end_date", parsed.data.attendanceDate),
  ]);
  if (teachersError || staffError || leavesError) return { error: "Attendance or approved leave data could not be verified." };
  const validTeacherIds = new Set((teachers ?? []).map((person) => person.id));
  const validStaffIds = new Set((staff ?? []).map((person) => person.id));
  if (parsed.data.records.some((record) => record.personType === "teacher" ? !validTeacherIds.has(record.personId) : !validStaffIds.has(record.personId))) return { error: "The people record does not match this school." };
  const leaveKeys = new Set((approvedLeaves ?? []).map((leave) => `${leave.teacher_id ? "teacher" : "staff"}:${leave.teacher_id ?? leave.staff_id}`));
  const rows = parsed.data.records.map((record) => {
    const personKey = `${record.personType}:${record.personId}`;
    const isOnApprovedLeave = leaveKeys.has(personKey);
    return {
      school_id: schoolId,
      teacher_id: record.personType === "teacher" ? record.personId : null,
      staff_id: record.personType === "staff" ? record.personId : null,
      attendance_date: parsed.data.attendanceDate,
      status: isOnApprovedLeave ? "excused" : record.status,
      ...(record.remarks ? { remarks: record.remarks } : {}),
      marked_by: user.id,
    };
  });
  const { data: existing, error: existingError } = await supabase.from("people_attendance").select("id,teacher_id,staff_id").eq("school_id", schoolId).eq("attendance_date", parsed.data.attendanceDate);
  if (existingError) return { error: "Existing people attendance records could not be checked." };
  const existingByPerson = new Map((existing ?? []).map((record) => [`${record.teacher_id ? "teacher" : "staff"}:${record.teacher_id ?? record.staff_id}`, record.id]));
  const saveResults = await Promise.all(rows.map(async (row) => {
    const personKey = `${row.teacher_id ? "teacher" : "staff"}:${row.teacher_id ?? row.staff_id}`;
    const existingId = existingByPerson.get(personKey);
    return existingId
      ? supabase.from("people_attendance").update(row).eq("id", existingId).eq("school_id", schoolId)
      : supabase.from("people_attendance").insert(row);
  }));
  if (saveResults.some((result) => result.error)) return { error: "People attendance could not be saved." };
  revalidatePath("/people-attendance");
  return { success: `Attendance saved for ${rows.length} teachers and staff.` };
}