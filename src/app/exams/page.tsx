import Link from "next/link";
import { ExamForm, ExamStatusForm, ExamTypeForm, GradeBoundaryForm, GradingScaleForm } from "@/components/exams/exam-forms";
import { requireExamContext } from "@/lib/exams/context";

function relation<T>(value: unknown): T | null { return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null; }

function EmptyState({ label, hint }: { label: string; hint: string }) { return <div className="student-empty"><h3>No {label} yet</h3><p>{hint}</p></div>; }

export default async function ExamsPage() {
  const { supabase, schoolId } = await requireExamContext("view");
  const [{ data: types }, { data: scales }, { data: activeTypes }, { data: activeScales }, { data: sessions }, { data: exams }] = await Promise.all([
    supabase.from("exam_types").select("id,name,description").eq("school_id", schoolId).order("name"),
    supabase.from("grading_scales").select("id,name,description,grade_boundaries(id,grade,min_percentage,max_percentage,grade_point,remark)").eq("school_id", schoolId).order("name"),
    supabase.from("exam_types").select("id,name").eq("school_id", schoolId).eq("is_active", true).order("name"),
    supabase.from("grading_scales").select("id,name").eq("school_id", schoolId).eq("is_active", true).order("name"),
    supabase.from("academic_sessions").select("id,name").eq("school_id", schoolId).order("starts_on", { ascending: false }),
    supabase.from("exams").select("id,name,starts_on,ends_on,status,exam_types(name),academic_sessions(name),grading_scales(name)").eq("school_id", schoolId).order("starts_on", { ascending: false }),
  ]);
  const typeRows = (types ?? []) as Array<Record<string, unknown>>;
  const scaleRows = (scales ?? []) as Array<Record<string, unknown>>;
  const rows = (exams ?? []) as Array<Record<string, unknown>>;
  const examId = (row: Record<string, unknown>) => String(row.id);
  return <main className="students-shell">
    <header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/dashboard">Dashboard -&gt;</Link></header>
    <section className="students-heading"><div><p className="eyebrow">Assessment</p><h1>Exams.</h1><p>Configure exam types and grading scales, then run the assessment workflow.</p></div></section>
    <section className="setup-card"><h3>Exam types</h3><ExamTypeForm /><div className="student-table-wrap"><table className="student-table"><thead><tr><th>Name</th><th>Description</th></tr></thead><tbody>{typeRows.length ? typeRows.map((type) => <tr key={String(type.id)}><td><strong>{String(type.name)}</strong></td><td>{String(type.description ?? "—")}</td></tr>) : <tr><td colSpan={2}><EmptyState label="exam types" hint="Add exam types like Monthly Test, Mid Term and Final Term." /></td></tr>}</tbody></table></div></section>
    <section className="setup-card"><h3>Grading scales</h3><GradingScaleForm />{scaleRows.map((scale) => { const boundaries = Array.isArray(scale.grade_boundaries) ? scale.grade_boundaries as Array<Record<string, unknown>> : []; return <div className="setup-card" key={String(scale.id)}><h4>{String(scale.name)}</h4><p className="student-muted">{String(scale.description ?? "")}</p><div className="student-table-wrap"><table className="student-table"><thead><tr><th>Grade</th><th>Min %</th><th>Max %</th><th>Point</th><th>Remark</th></tr></thead><tbody>{boundaries.map((boundary) => <tr key={String(boundary.id)}><td><strong>{String(boundary.grade)}</strong></td><td>{String(boundary.min_percentage)}</td><td>{String(boundary.max_percentage)}</td><td>{String(boundary.grade_point ?? "—")}</td><td>{String(boundary.remark ?? "—")}</td></tr>)}</tbody></table></div><GradeBoundaryForm gradingScaleId={String(scale.id)} /></div>; })}</section>
    <section className="setup-card"><h3>Create exam</h3><ExamForm types={activeTypes ?? []} sessions={sessions ?? []} scales={activeScales ?? []} /></section>
    <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Exam</th><th>Type</th><th>Session</th><th>Dates</th><th>Status</th><th>Workflow</th></tr></thead><tbody>{rows.length ? rows.map((exam) => { const type = relation<{ name: string }>(exam.exam_types); const session = relation<{ name: string }>(exam.academic_sessions); return <tr key={examId(exam)}><td><Link className="student-name" href={`/exams/${examId(exam)}`}><strong>{String(exam.name)}</strong><small>Manage subjects, schedules and marks</small></Link></td><td>{type?.name}</td><td>{session?.name}</td><td>{String(exam.starts_on)} - {String(exam.ends_on)}</td><td><span className={`status-pill ${String(exam.status)}`}>{String(exam.status)}</span></td><td><ExamStatusForm id={examId(exam)} status={String(exam.status)} /></td></tr>; }) : <tr><td colSpan={6}><EmptyState label="exams" hint="Create an exam to begin the grading workflow." /></td></tr>}</tbody></table></div>
  </main>;
}