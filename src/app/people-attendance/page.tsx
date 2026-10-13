import Link from "next/link";

import { PeopleAttendanceMarker } from "@/components/people/people-attendance-marker";
import { requirePeopleAttendanceContext } from "@/lib/people/attendance-context";

type SearchParams = Promise<{ date?: string }>;
type AttendanceRow = { teacher_id: string | null; staff_id: string | null; status: string };
type ApprovedLeaveRow = { teacher_id: string | null; staff_id: string | null };

function currentDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default async function PeopleAttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const date = params.date ?? currentDate();
  const { supabase, schoolId } = await requirePeopleAttendanceContext("view");
  const [{ data: teachers, error: teachersError }, { data: staff, error: staffError }, { data: attendance, error: attendanceError }, { data: approvedLeaves, error: leavesError }] = await Promise.all([
    supabase.from("teachers").select("id,first_name,last_name,employee_code,specialization").eq("school_id", schoolId).eq("employment_status", "active").order("last_name"),
    supabase.from("staff").select("id,first_name,last_name,employee_code,department,designation").eq("school_id", schoolId).eq("employment_status", "active").order("last_name"),
    supabase.from("people_attendance").select("teacher_id,staff_id,status").eq("school_id", schoolId).eq("attendance_date", date),
    supabase.from("leave_requests").select("teacher_id,staff_id").eq("school_id", schoolId).eq("status", "approved").lte("start_date", date).gte("end_date", date),
  ]);
  if (teachersError || staffError || attendanceError || leavesError) {
    console.error("People attendance register could not be loaded.", { teachersError, staffError, attendanceError, leavesError });
    throw new Error("People attendance register could not be loaded.");
  }
  const rows = (attendance ?? []) as AttendanceRow[];
  const leaveRows = (approvedLeaves ?? []) as ApprovedLeaveRow[];
  const onApprovedLeave = (personId: string, personType: "teacher" | "staff") => leaveRows.some((row) => personType === "teacher" ? row.teacher_id === personId : row.staff_id === personId);
  const statusFor = (personId: string, personType: "teacher" | "staff") => onApprovedLeave(personId, personType)
    ? "excused"
    : rows.find((row) => personType === "teacher" ? row.teacher_id === personId : row.staff_id === personId)?.status;
  const people = [
    ...(teachers ?? []).map((person) => ({ id: person.id, personType: "teacher" as const, name: `${person.first_name} ${person.last_name}`.trim(), employeeCode: person.employee_code, department: person.specialization, approvedLeave: onApprovedLeave(person.id, "teacher"), status: statusFor(person.id, "teacher") })),
    ...(staff ?? []).map((person) => ({ id: person.id, personType: "staff" as const, name: `${person.first_name} ${person.last_name}`.trim(), employeeCode: person.employee_code, department: person.department ?? person.designation, approvedLeave: onApprovedLeave(person.id, "staff"), status: statusFor(person.id, "staff") })),
  ];
  const present = people.filter((person) => !person.status || person.status === "present" || person.status === "half_day").length;
  const absent = people.filter((person) => person.status === "absent").length;
  const late = people.filter((person) => person.status === "late").length;
  const excused = people.filter((person) => person.status === "excused").length;
  const progress = (value: number) => people.length ? Math.round((value / people.length) * 100) : 0;
  return <main className="attendance-shell"><header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><div><Link className="text-action" href="/leave">Leave register →</Link><Link className="text-action students-header-link" href="/teachers">Teachers</Link><Link className="text-action students-header-link" href="/staff">Staff</Link></div></header><section className="module-page-header"><div className="module-page-header__row"><div><p className="module-page-header__eyebrow">HR operations</p><h1>People attendance.</h1><p>Track daily attendance for active teachers and staff in one roster. Approved leave automatically counts as excused.</p></div></div></section><section className="attendance-summary-panel" aria-label="People attendance summary"><div><span className="attendance-summary-panel__label">Daily HR summary</span><strong>{people.length} active people</strong><small>{date}</small></div><div className="attendance-summary-panel__statuses"><span className="attendance-summary-status attendance-summary-status--present"><i style={{ background: `conic-gradient(#047857 ${progress(present)}%, #e5eaf1 0)` }}><b>{present}</b></i><em>Present</em><small>{progress(present)}%</small></span><span className="attendance-summary-status attendance-summary-status--absent"><i style={{ background: `conic-gradient(#be123c ${progress(absent)}%, #e5eaf1 0)` }}><b>{absent}</b></i><em>Absent</em><small>{progress(absent)}%</small></span><span className="attendance-summary-status attendance-summary-status--late"><i style={{ background: `conic-gradient(#a16207 ${progress(late)}%, #e5eaf1 0)` }}><b>{late}</b></i><em>Late</em><small>{progress(late)}%</small></span><span className="attendance-summary-status attendance-summary-status--excused"><i style={{ background: `conic-gradient(#1d4ed8 ${progress(excused)}%, #e5eaf1 0)` }}><b>{excused}</b></i><em>Excused</em><small>{progress(excused)}%</small></span></div></section><form className="attendance-filters"><label>Date<input type="date" name="date" defaultValue={date} /></label><button type="submit">Load people</button></form>{people.length ? <PeopleAttendanceMarker attendanceDate={date} people={people} /> : <div className="student-empty attendance-empty"><h3>No active teachers or staff</h3><p>Add active people in the Teachers or Staff modules first.</p></div>}</main>;
}