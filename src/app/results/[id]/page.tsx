import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportCardPrintButton } from "@/components/results/report-card-print-button";

function relation<T>(value: unknown): T | null { return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null; }

export default async function ResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();
  const { data: membership } = await supabase.from("user_roles").select("school_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership?.school_id) return notFound();
  const schoolId = membership.school_id as string;
  const { data: exam } = await supabase.from("exams").select("id,name,starts_on,ends_on,status,academic_sessions(name),schools(name),grading_scales(name)").eq("id", id).eq("school_id", schoolId).eq("status", "published").maybeSingle();
  if (!exam) return notFound();
  const examRecord = exam as Record<string, unknown>;
  const session = relation<{ name: string }>(examRecord.academic_sessions);
  const school = relation<{ name: string }>(examRecord.schools);
  const scale = relation<{ name: string }>(examRecord.grading_scales);
  const { data: resultRows } = await supabase.from("published_exam_results").select("*").eq("exam_id", id).eq("school_id", schoolId).order("subject_name");
  const rows = (resultRows ?? []) as Array<Record<string, unknown>>;
  if (!rows.length) return <main className="students-shell"><header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link></header><section className="student-empty"><h3>No published result data</h3><p>Marks are not published for this exam yet.</p></section></main>;

  const student = rows[0];
  const studentName = `${String(student.first_name ?? "")} ${String(student.middle_name ?? "")} ${String(student.last_name ?? "")}`.trim();
  const studentClass = String(student.class_name ?? "");
  const studentSection = String(student.section_name ?? "");
  const attendance = 0;
  const totalMax = rows.reduce((sum, row) => sum + Number(row.maximum_marks ?? 0), 0);
  const totalSecured = rows.reduce((sum, row) => sum + Number(row.obtained_marks ?? 0), 0);
  const avgPercentage = rows.length ? (rows.reduce((sum, row) => sum + Number(row.percentage ?? 0), 0) / rows.length).toFixed(2) : "0.00";
  const overallGrade = rows.find((row) => row.grade) ? rows.reduce((best, row) => (String(row.grade ?? "") > String(best.grade ?? "") ? row : best), rows[0]).grade : "-";

  return <main className="students-shell">
    <header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/results">All results -&gt;</Link></header>
    <section className="student-profile-heading"><div><p className="eyebrow">Academic report</p><h1>{String(examRecord.name)}</h1><p>{school?.name ?? "School"} · {session?.name ?? "Session"} · {String(examRecord.starts_on)} to {String(examRecord.ends_on)}</p></div><ReportCardPrintButton /></section>
    <section className="setup-card" style={{ maxWidth: 1100, margin: "0 auto 20px" }}>
      <div className="student-profile-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <h3>Student information</h3>
          <p><strong>Name:</strong> {studentName}</p>
          <p><strong>Admission no:</strong> {String(student.admission_number ?? "-")}</p>
          <p><strong>Class/Section:</strong> {studentClass} / {studentSection}</p>
        </div>
        <div>
          <h3>Summary</h3>
          <p><strong>Average percentage:</strong> {avgPercentage}%</p>
          <p><strong>Overall grade:</strong> {String(overallGrade ?? "-")}</p>
          <p><strong>Attendance:</strong> {attendance}%</p>
        </div>
      </div>
    </section>
    <section className="setup-card" style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div className="student-table-wrap">
        <table className="student-table">
          <thead><tr><th>Subject</th><th>Marks obtained</th><th>Max marks</th><th>Percentage</th><th>Grade</th><th>Remarks</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={String(row.exam_subject_id)}><td><strong>{String(row.subject_name)}</strong><small>{String(row.subject_code ?? "-")}</small></td><td>{String(row.obtained_marks)}</td><td>{String(row.maximum_marks)}</td><td>{String(row.percentage)}%</td><td>{String(row.grade ?? "-")}</td><td>{String(row.remarks ?? "-")}</td></tr>)}</tbody>
        </table>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
        <div><strong>Total secured:</strong> {totalSecured}/{totalMax}</div>
        <div><strong>Average percentage:</strong> {avgPercentage}%</div>
        <div><strong>Scale:</strong> {String(scale?.name ?? "-")}</div>
      </div>
    </section>
    <section className="setup-card" style={{ maxWidth: 1100, margin: "20px auto 0" }}>
      <h3>Teacher remarks & signatures</h3>
      <p>Class teacher remarks: {rows.map((row) => row.remarks).filter(Boolean).slice(0, 1).join(" ") || "No teacher remark submitted."}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 20 }}>
        <div><p><strong>Class teacher</strong></p><p>__________________________</p></div>
        <div><p><strong>Principal / Head</strong></p><p>__________________________</p></div>
      </div>
    </section>
  </main>;
}
