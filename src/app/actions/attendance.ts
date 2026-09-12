"use server";

import { revalidatePath } from "next/cache";

import { requireAttendanceContext } from "@/lib/attendance/context";
import { attendanceSubmissionSchema, type AttendanceFormState } from "@/lib/attendance/schemas";

export async function submitAttendance(_: AttendanceFormState | undefined, formData: FormData): Promise<AttendanceFormState> {
  const rawRecords = String(formData.get("records") ?? "[]"); let records: unknown;
  try { records = JSON.parse(rawRecords); } catch { return { error: "Attendance records invalid hain." }; }
  const parsed = attendanceSubmissionSchema.safeParse({ attendanceDate: formData.get("attendanceDate"), classId: formData.get("classId"), sectionId: formData.get("sectionId"), records });
  if (!parsed.success) return { error: "Attendance form complete nahi hai." };
  const { supabase, schoolId, user } = await requireAttendanceContext("manage");
  const ids = parsed.data.records.map((record) => record.enrollmentId);
  const { data: enrollments } = await supabase.from("student_enrollments").select("id,student_id,class_id,section_id").eq("school_id", schoolId).eq("class_id", parsed.data.classId).eq("section_id", parsed.data.sectionId).in("id", ids);
  const valid = new Map((enrollments ?? []).map((enrollment) => [enrollment.id, enrollment]));
  if (valid.size !== parsed.data.records.length || parsed.data.records.some((record) => valid.get(record.enrollmentId)?.student_id !== record.studentId)) return { error: "Enrollment aur student match nahi karte." };
  const rows = parsed.data.records.map((record) => ({ school_id: schoolId, student_id: record.studentId, enrollment_id: record.enrollmentId, attendance_date: parsed.data.attendanceDate, status: record.status, remarks: record.remarks || null, marked_by: user.id }));
  const { error } = await supabase.from("student_attendance").upsert(rows, { onConflict: "school_id,student_id,attendance_date" });
  if (error) return { error: "Attendance save nahi ho saki." };
  revalidatePath("/attendance"); revalidatePath("/attendance/reports"); return { success: `${rows.length} students ki attendance save ho gayi.` };
}