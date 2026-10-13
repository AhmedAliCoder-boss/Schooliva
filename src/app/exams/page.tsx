import Link from "next/link";

import { ExamForm, ExamTypeForm, GradeBoundaryForm, GradingScaleForm } from "@/components/exams/exam-forms";
import { requireExamContext } from "@/lib/exams/context";

type ExamRow = Record<string, unknown>;

function relation<T>(value: unknown): T | null {
  return Array.isArray(value) ? (value[0] ?? null) as T | null : value as T | null;
}

function EmptyState({ label, hint }: { label: string; hint: string }) {
  return <div className="student-empty"><h3>No {label} yet</h3><p>{hint}</p></div>;
}

const workflowStages = [
  { id: "draft", title: "1. Plan", description: "Create an exam, assign class subjects, then build its timetable." },
  { id: "submitted", title: "2. Mark", description: "Submit each fully scheduled section and enter its students' scores." },
  { id: "reviewed", title: "3. Review", description: "Review every section after all its enrolled students have marks." },
  { id: "published", title: "4. Publish", description: "The exam is complete only after every active section is published." },
];

export default async function ExamsPage() {
  const { supabase, schoolId } = await requireExamContext("view");
  const [
    { data: types, error: typesError },
    { data: scales, error: scalesError },
    { data: activeTypes, error: activeTypesError },
    { data: activeScales, error: activeScalesError },
    { data: sessions, error: sessionsError },
    { data: exams, error: examsError },
    { data: canManageExams, error: examPermissionError },
    { data: canManageGrading, error: gradingPermissionError },
  ] = await Promise.all([
    supabase.from("exam_types").select("id,name,description,is_active").eq("school_id", schoolId).order("name"),
    supabase.from("grading_scales").select("id,name,description,is_active,grade_boundaries(id,grade,min_percentage,max_percentage,grade_point,remark)").eq("school_id", schoolId).order("name"),
    supabase.from("exam_types").select("id,name").eq("school_id", schoolId).eq("is_active", true).order("name"),
    supabase.from("grading_scales").select("id,name").eq("school_id", schoolId).eq("is_active", true).order("name"),
    supabase.from("academic_sessions").select("id,name").eq("school_id", schoolId).order("starts_on", { ascending: false }),
    supabase.from("exams").select("id,name,starts_on,ends_on,status,exam_types(name),academic_sessions(name),grading_scales(name)").eq("school_id", schoolId).order("starts_on", { ascending: false }),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "exams", target_action: "manage" }),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "grading", target_action: "manage" }),
  ]);
  const dataError = typesError ?? scalesError ?? activeTypesError ?? activeScalesError ?? sessionsError ?? examsError ?? examPermissionError ?? gradingPermissionError;
  if (dataError) {
    console.error("Exam workspace could not be loaded.", dataError);
    return <main className="students-shell"><p className="auth-error">The exam workspace could not be loaded. Refresh and try again.</p></main>;
  }

  const typeRows = (types ?? []) as Array<Record<string, unknown>>;
  const scaleRows = (scales ?? []) as Array<Record<string, unknown>>;
  const rows = (exams ?? []) as ExamRow[];
  const counts = {
    draft: rows.filter((exam) => exam.status === "draft").length,
    submitted: rows.filter((exam) => exam.status === "submitted").length,
    reviewed: rows.filter((exam) => exam.status === "reviewed").length,
    published: rows.filter((exam) => exam.status === "published").length,
  };

  return (
    <main className="students-shell exams-workspace">
      <header className="students-header">
        <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
        <nav aria-label="Exam navigation">
          <Link className="text-action" href="/exams">Exams</Link>
          <Link className="text-action" href="/exams/timetable">Exam timetable</Link>
          <Link className="text-action" href="/dashboard">Dashboard</Link>
        </nav>
      </header>

      <section className="students-heading exams-heading">
        <div>
          <p className="eyebrow">Assessment workspace</p>
          <h1>Exams.</h1>
          <p>Plan each exam, build the class timetable, enter and review marks, then publish results.</p>
        </div>
        <Link className="exams-primary-link" href="/exams/timetable">Open exam timetable <span aria-hidden="true">→</span></Link>
      </section>

      <section aria-label="Exam workflow" className="exam-workflow-overview">
        {workflowStages.map((stage) => (
          <article className="exam-workflow-stage" key={stage.id}>
            <span>{stage.title}</span>
            <p>{stage.description}</p>
            <strong>{counts[stage.id as keyof typeof counts]}</strong>
            <small>{stage.id === "draft" ? "planning" : stage.id === "submitted" ? "awaiting marks" : stage.id === "reviewed" ? "ready to publish" : "published"}</small>
          </article>
        ))}
      </section>

      {canManageExams === true && <section className="setup-card exams-create-card" id="create-exam">
        <div className="exams-section-heading">
          <div><p className="eyebrow">Start an assessment</p><h2>Create exam</h2></div>
          <p>Choose the session and date range first. Subjects and exam dates are set up in the exam workspace.</p>
        </div>
        <ExamForm types={activeTypes ?? []} sessions={sessions ?? []} scales={activeScales ?? []} />
        {(!activeTypes?.length || !sessions?.length) && <p className="exams-inline-hint">An active exam type and an academic session are required before an exam can be created.</p>}
      </section>}

      <section className="setup-card exams-register-card">
        <div className="exams-section-heading">
          <div><p className="eyebrow">Assessment register</p><h2>All exams</h2></div>
          <span>{rows.length} total</span>
        </div>
        {rows.length ? <div className="student-table-wrap">
          <table className="student-table exams-register">
            <thead><tr><th>Exam</th><th>Type</th><th>Session</th><th>Exam dates</th><th>Stage</th><th>Next step</th></tr></thead>
            <tbody>{rows.map((exam) => {
              const id = String(exam.id);
              const type = relation<{ name: string }>(exam.exam_types);
              const session = relation<{ name: string }>(exam.academic_sessions);
              const scale = relation<{ name: string }>(exam.grading_scales);
              return <tr key={id}>
                <td><Link className="student-name" href={`/exams/${id}`}><strong>{String(exam.name)}</strong><small>{scale?.name ? `Grading: ${scale.name}` : "Manage subjects, timetable, and marks"}</small></Link></td>
                <td>{type?.name ?? "—"}</td>
                <td>{session?.name ?? "—"}</td>
                <td>{String(exam.starts_on)} – {String(exam.ends_on)}</td>
                <td><span className={`status-pill ${String(exam.status)}`}>{exam.status === "draft" ? "pending" : String(exam.status)}</span></td>
                <td><Link className="text-action" href={`/exams/${id}`}>Open workflow →</Link></td>
              </tr>;
            })}</tbody>
          </table>
        </div> : <EmptyState label="exams" hint="Create an exam above to begin its subject, timetable, and grading workflow." />}
      </section>

      <details className="setup-card exams-configuration" id="exam-configuration" open={!activeTypes?.length || !activeScales?.length}>
        <summary>
          <span><strong>Exam setup & grading scales</strong><small>Manage exam types and reusable grade boundaries.</small></span>
          <span className="exams-configuration-toggle" aria-hidden="true">⌄</span>
        </summary>
        <div className="exams-configuration-grid">
          <section className="exams-configuration-panel">
            <div className="exams-section-heading"><div><p className="eyebrow">Reusable setup</p><h2>Exam types</h2></div></div>
            {canManageExams === true && <ExamTypeForm />}
            <div className="student-table-wrap"><table className="student-table">
              <thead><tr><th>Type</th><th>Description</th><th>Status</th></tr></thead>
              <tbody>{typeRows.length ? typeRows.map((type) => <tr key={String(type.id)}>
                <td><strong>{String(type.name)}</strong></td><td>{String(type.description ?? "—")}</td>
                <td><span className={`status-pill ${type.is_active ? "active" : "inactive"}`}>{type.is_active ? "Active" : "Inactive"}</span></td>
              </tr>) : <tr><td colSpan={3}><EmptyState label="exam types" hint="Add Monthly Test, Mid Term, Final Term, or another assessment type." /></td></tr>}</tbody>
            </table></div>
          </section>

          <section className="exams-configuration-panel">
            <div className="exams-section-heading"><div><p className="eyebrow">Results setup</p><h2>Grading scales</h2></div></div>
            {canManageGrading === true && <GradingScaleForm />}
            {scaleRows.length ? scaleRows.map((scale) => {
              const boundaries = Array.isArray(scale.grade_boundaries) ? scale.grade_boundaries as Array<Record<string, unknown>> : [];
              return <article className="exams-grade-scale" key={String(scale.id)}>
                <div className="exams-grade-scale__heading">
                  <div><h3>{String(scale.name)}</h3><p>{String(scale.description ?? "")}</p></div>
                  <span>{boundaries.length} grade bands</span>
                </div>
                {boundaries.length ? <div className="student-table-wrap"><table className="student-table">
                  <thead><tr><th>Grade</th><th>Range</th><th>Point</th><th>Remark</th></tr></thead>
                  <tbody>{boundaries.map((boundary) => <tr key={String(boundary.id)}>
                    <td><strong>{String(boundary.grade)}</strong></td>
                    <td>{String(boundary.min_percentage)}% – {String(boundary.max_percentage)}%</td>
                    <td>{String(boundary.grade_point ?? "—")}</td><td>{String(boundary.remark ?? "—")}</td>
                  </tr>)}</tbody>
                </table></div> : <p className="exams-inline-hint">Add grade bands to make this scale ready to use.</p>}
                {canManageGrading === true && <GradeBoundaryForm gradingScaleId={String(scale.id)} />}
              </article>;
            }) : <EmptyState label="grading scales" hint="Create a grading scale before starting marks review." />}
          </section>
        </div>
      </details>
    </main>
  );
}
