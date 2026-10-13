import Link from "next/link";

import { AttendanceFilters } from "@/components/attendance/attendance-filters";
import { AttendanceMarker } from "@/components/attendance/attendance-marker";
import { requireAttendanceContext } from "@/lib/attendance/context";

type SearchParams = Promise<{ date?: string; classId?: string; sectionId?: string }>;
type AttendanceStudent = {
  id: string;
  enrollmentId: string;
  name: string;
  studentIdentifier: string;
  admissionNumber: string;
  phone: string;
  rollNumber: string;
  status?: string;
  remarks?: string | null;
};

export default async function AttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, schoolId } = await requireAttendanceContext("manage");
  const date = params.date ?? new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [
    { data: classes, error: classesError },
    { data: sections, error: sectionsError },
  ] = await Promise.all([
    supabase.from("classes").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("sections").select("id,name,class_id").eq("school_id", schoolId).eq("status", "active").order("name"),
  ]);
  if (classesError || sectionsError) throw new Error("Attendance class and section options could not be loaded.");

  const activeClasses = classes ?? [];
  const activeClassIds = new Set(activeClasses.map((item) => String(item.id)));
  const selectedClass = activeClasses.find((item) => String(item.id) === params.classId);
  const activeSections = (sections ?? []).filter((section) => activeClassIds.has(String(section.class_id)));
  const selectedSection = activeSections.find((section) =>
    String(section.id) === params.sectionId && String(section.class_id) === String(selectedClass?.id),
  );
  const rosterSelection = selectedClass && selectedSection ? { selectedClass, selectedSection } : null;
  let students: AttendanceStudent[] = [];

  if (rosterSelection) {
    const { data, error } = await supabase.from("student_enrollments")
      .select("id,student_id,roll_number,students(first_name,middle_name,last_name,admission_number,student_identifier,phone),student_attendance(status,remarks,attendance_date)")
      .eq("school_id", schoolId)
      .eq("class_id", rosterSelection.selectedClass.id)
      .eq("section_id", rosterSelection.selectedSection.id)
      .eq("status", "active")
      .eq("student_attendance.attendance_date", date);
    if (error) throw new Error("Attendance roster could not be loaded.");
    students = (data ?? []).map((row) => {
      const student = Array.isArray(row.students) ? row.students[0] : row.students;
      const attendance = Array.isArray(row.student_attendance) ? row.student_attendance[0] : row.student_attendance;
      return {
        id: String(row.student_id),
        enrollmentId: String(row.id),
        name: `${student?.first_name ?? ""} ${student?.middle_name ?? ""} ${student?.last_name ?? ""}`.trim(),
        studentIdentifier: student?.student_identifier ?? "",
        admissionNumber: student?.admission_number ?? "",
        phone: student?.phone ?? "",
        rollNumber: row.roll_number == null ? "" : String(row.roll_number),
        status: attendance?.status,
        remarks: attendance?.remarks,
      };
    });
  }

  const present = students.filter((student) => !student.status || student.status === "present" || student.status === "half_day").length;
  const absent = students.filter((student) => student.status === "absent").length;
  const late = students.filter((student) => student.status === "late").length;
  const excused = students.filter((student) => student.status === "excused").length;
  const attendanceTotal = students.length;
  const progress = (value: number) => attendanceTotal ? Math.round((value / attendanceTotal) * 100) : 0;
  return <main className="attendance-shell">
    <header className="students-header">
      <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
      <div><Link className="text-action" href="/attendance/reports">Reports -&gt;</Link><Link className="text-action students-header-link" href="/dashboard">Dashboard -&gt;</Link></div>
    </header>
    <section className="module-page-header">
      <div className="module-page-header__row"><div>
        <p className="module-page-header__eyebrow">Daily operations</p>
        <h1>Attendance.</h1>
        <p>Mark daily attendance from the active enrollment roster.</p>
      </div></div>
    </section>
    {rosterSelection && <section className="attendance-summary-panel" aria-label="Attendance summary">
      <div><span className="attendance-summary-panel__label">Attendance summary</span><strong>{students.length} enrolled students</strong><small>{date}</small></div>
      <div className="attendance-summary-panel__statuses">
        <span className="attendance-summary-status attendance-summary-status--present"><i style={{ background: `conic-gradient(#047857 ${progress(present)}%, #e5eaf1 0)` }}><b>{present}</b></i><em>Present</em><small>{progress(present)}%</small></span>
        <span className="attendance-summary-status attendance-summary-status--absent"><i style={{ background: `conic-gradient(#be123c ${progress(absent)}%, #e5eaf1 0)` }}><b>{absent}</b></i><em>Absent</em><small>{progress(absent)}%</small></span>
        <span className="attendance-summary-status attendance-summary-status--late"><i style={{ background: `conic-gradient(#a16207 ${progress(late)}%, #e5eaf1 0)` }}><b>{late}</b></i><em>Late</em><small>{progress(late)}%</small></span>
        <span className="attendance-summary-status attendance-summary-status--excused"><i style={{ background: `conic-gradient(#1d4ed8 ${progress(excused)}%, #e5eaf1 0)` }}><b>{excused}</b></i><em>Excused</em><small>{progress(excused)}%</small></span>
      </div>
    </section>}
    <AttendanceFilters
      date={date}
      selectedClassId={selectedClass ? String(selectedClass.id) : ""}
      selectedSectionId={selectedSection ? String(selectedSection.id) : ""}
      classes={activeClasses.map((item) => ({ id: String(item.id), name: item.name }))}
      sections={activeSections.map((item) => ({ id: String(item.id), name: item.name, class_id: String(item.class_id) }))}
    />
    {rosterSelection
      ? <AttendanceMarker
          attendanceDate={date}
          classId={String(rosterSelection.selectedClass.id)}
          className={rosterSelection.selectedClass.name}
          sectionId={String(rosterSelection.selectedSection.id)}
          sectionName={rosterSelection.selectedSection.name}
          students={students}
        />
      : <div className="student-empty attendance-empty"><h3>Select a class, section and date</h3><p>Choose an active class first; only its active sections are listed.</p></div>}
  </main>;
}
