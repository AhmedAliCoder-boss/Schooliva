import Link from "next/link";
import { notFound } from "next/navigation";

import { ExamScheduleForm, ExamStatusForm, ExamSubjectForm, MarksEntryForm, RemoveExamSchedule, RemoveExamSubject } from "@/components/exams/exam-forms";
import { requireExamContext } from "@/lib/exams/context";

function relation<T>(value: unknown): T | null { return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null; }

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ subject?: string }>;

export default async function ExamDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params; const query = await searchParams;
  const { supabase, schoolId } = await requireExamContext("view");
  const [{ data: exam }, { data: subjectRows }, { data: classRows }, { data: subjectCatalog }, { data: sectionRows }] = await Promise.all([
    supabase.from("exams").select("id,name,starts_on,ends_on,status,academic_session_id,exam_types(name),academic_sessions(name),grading_scales(name)").eq("id", id).eq("school_id", schoolId).maybeSingle(),
    supabase.from("exam_subjects").select("id,maximum_marks,passing_marks,class_id,classes(name),subjects(name,code)").eq("exam_id", id).eq("school_id", schoolId).order("created_at"),
    supabase.from("classes").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("subjects").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("sections").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
  ]);
  if (!exam) notFound();
  const record = exam as unknown as Record<string, unknown>;
  const subjects = (subjectRows ?? []) as Array<Record<string, unknown>>;
  const subjectIds = subjects.map((item) => String(item.id));
  const { data: scheduleRows } = subjectIds.length ? await supabase.from("exam_schedules").select("id,scheduled_on,starts_at,ends_at,room,sections(name),exam_subjects(subjects(name),classes(name))").in("exam_subject_id", subjectIds).eq("school_id", schoolId).order("scheduled_on") : { data: [] };
  const schedules = (scheduleRows ?? []) as Array<Record<string, unknown>>;
  const examSubjects = subjects.map((item) => ({ id: String(item.id), name: `${relation<{ name: string }>(item.subjects)?.name ?? "Subject"} · ${relation<{ name: string }>(item.classes)?.name ?? "Class"}` }));
  const examType = relation<{ name: string }>(record.exam_types);
  const session = relation<{ name: string }>(record.academic_sessions);
  const scale = relation<{ name: string }>(record.grading_scales);
  let students: Array<{ id: string; name: string; admissionNumber: string; maximumMarks: number; existing?: { obtainedMarks?: number | null; grade?: string | null; remarks?: string | null } }> = [];
  const published = String(record.status) === "published";
  const selectedSubject = subjects.find((item) => String(item.id) === query.subject);
  if (query.subject && selectedSubject) {
    const classId = String(selectedSubject.class_id); const maximumMarks = Number(selectedSubject.maximum_marks ?? 0);
    const { data: enrollments } = await supabase.from("student_enrollments").select("student_id,students(first_name,middle_name,last_name,admission_number)").eq("school_id", schoolId).eq("class_id", classId).eq("academic_session_id", String(record.academic_session_id)).eq("status", "active");
    const { data: existingMarks } = await supabase.from("marks").select("student_id,obtained_marks,grade,remarks").eq("school_id", schoolId).eq("exam_subject_id", String(query.subject));
    const markLookup = new Map((existingMarks ?? []).map((mark) => [String(mark.student_id), mark]));
    students = (enrollments ?? []).map((enrollment) => { const student = Array.isArray(enrollment.students) ? enrollment.students[0] : enrollment.students; const mark = markLookup.get(String(enrollment.student_id)); return { id: String(enrollment.student_id), name: `${student?.first_name ?? ""} ${student?.middle_name ?? ""} ${student?.last_name ?? ""}`.trim(), admissionNumber: student?.admission_number ?? "", maximumMarks, existing: mark ? { obtainedMarks: mark.obtained_marks, grade: mark.grade, remarks: mark.remarks } : undefined }; });
  }
  return <main className="students-shell">
    <header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/exams">All exams -&gt;</Link></header>
    <section className="student-profile-heading"><div><p className="eyebrow">Assessment</p><h1>{String(record.name)}</h1><p>{examType?.name ?? "Exam"} · {session?.name ?? ""} · {String(record.starts_on)} to {String(record.ends_on)}{scale ? ` · ${scale.name}` : ""}</p></div><span className={`status-pill ${String(record.status)}`}>{String(record.status)}</span></section>
    {!published && <section className="setup-card"><h3>Workflow</h3><ExamStatusForm id={id} status={String(record.status)} /></section>}
    <section className="setup-card"><h3>Subjects</h3>{subjects.length ? <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Subject</th><th>Class</th><th>Maximum marks</th><th>Passing marks</th><th /></tr></thead><tbody>{subjects.map((subject) => <tr key={String(subject.id)}><td><strong>{relation<{ name: string }>(subject.subjects)?.name ?? "—"}</strong><small>{relation<{ name: string; code?: string }>(subject.subjects)?.code ?? ""}</small></td><td>{relation<{ name: string }>(subject.classes)?.name ?? "—"}</td><td>{String(subject.maximum_marks)}</td><td>{String(subject.passing_marks ?? "—")}</td><td>{!published && <RemoveExamSubject id={String(subject.id)} examId={id} />}</td></tr>)}</tbody></table></div> : <div className="student-empty"><h3>No subjects yet</h3><p>Add subjects to begin building the exam.</p></div>}{!published && <ExamSubjectForm examId={id} classes={classRows ?? []} subjects={subjectCatalog ?? []} />}</section>
    <section className="setup-card"><h3>Schedule</h3>{schedules.length ? <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Subject</th><th>Section</th><th>Date</th><th>Time</th><th>Room</th><th /></tr></thead><tbody>{schedules.map((schedule) => { const subject = relation<{ subjects?: unknown; classes?: unknown }>(schedule.exam_subjects); const subjectRow = relation<{ name: string }>(subject?.subjects); const classRow = relation<{ name: string }>(subject?.classes); const section = relation<{ name: string }>(schedule.sections); return <tr key={String(schedule.id)}><td><strong>{subjectRow?.name ?? "—"}</strong><small>{classRow?.name ?? ""}</small></td><td>{section?.name ?? "—"}</td><td>{String(schedule.scheduled_on)}</td><td>{String(schedule.starts_at).slice(0, 5)} - {String(schedule.ends_at).slice(0, 5)}</td><td>{String(schedule.room ?? "—")}</td><td>{!published && <RemoveExamSchedule id={String(schedule.id)} examId={id} />}</td></tr>; })}</tbody></table></div> : <p className="student-muted">No schedules yet. Add exam schedules for sections.</p>}{!published && <ExamScheduleForm examId={id} examSubjects={examSubjects} sections={sectionRows ?? []} />}</section>
    <section className="setup-card"><h3>Marks entry</h3><form className="attendance-filters"><label>Exam subject<select name="subject" defaultValue={query.subject ?? ""}><option value="">Select subject</option>{examSubjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="submit">Load roster</button></form>{query.subject && selectedSubject ? (students.length ? <MarksEntryForm examId={id} examSubjectId={String(selectedSubject.id)} students={students} published={published} /> : <div className="student-empty attendance-empty"><h3>No enrolled students</h3><p>No active students are enrolled in this subject&apos;s class for the exam session.</p></div>) : <div className="student-empty attendance-empty"><h3>Select an exam subject</h3><p>Enrolled students will appear here for mark entry.</p></div>}</section>
  </main>;
}