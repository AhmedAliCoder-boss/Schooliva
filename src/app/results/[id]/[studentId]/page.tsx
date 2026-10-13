import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintAction } from "@/components/print/print-action";
import { SchoolDocument } from "@/components/print/school-document";
import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { getSchoolDocumentIdentity } from "@/lib/print/school-document";
import { calculateReportCardSummary, getEffectivePassingMarks, getStudentPosition, type GradeBoundary, type ReportMark } from "@/lib/results/report-card";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ id: string; studentId: string }>;
type SearchParams = Promise<{ print?: string }>;
type ResultRow = Record<string, unknown>;

function relation<T>(value: unknown): T | null {
  return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null;
}

function formatMarks(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

export default async function StudentReportCardPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id: examId, studentId } = await params;
  const { print } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { schoolId } = await getActiveSchoolContext(supabase, user.id);
  if (!schoolId) notFound();

  const [{ data: exam, error: examError }, { data: resultRows, error: resultsError }] = await Promise.all([
    supabase.from("exams")
      .select("id,name,starts_on,ends_on,status,grading_scale_id,academic_session_id,academic_sessions(name)")
      .eq("id", examId).eq("school_id", schoolId).eq("status", "published").maybeSingle(),
    supabase.from("published_exam_results")
      .select("exam_subject_id,student_id,first_name,middle_name,last_name,student_identifier,admission_number,class_id,class_name,section_id,section_name,subject_name,subject_code,obtained_marks,maximum_marks,passing_marks,percentage,grade,remarks")
      .eq("exam_id", examId).eq("school_id", schoolId).eq("student_id", studentId)
      .order("subject_name"),
  ]);
  if (examError || resultsError) {
    console.error("Individual published report card could not be loaded.", examError ?? resultsError);
    return <main className="school-document-page"><p className="student-error">Report card could not be loaded. Refresh and try again.</p></main>;
  }
  if (!exam || !resultRows?.length) notFound();

  const school = await getSchoolDocumentIdentity(supabase, schoolId);
  const rows = resultRows as ResultRow[];
  const first = rows[0];
  const examSession = relation<{ name: string }>(exam.academic_sessions);
  const scaleId = exam.grading_scale_id ? String(exam.grading_scale_id) : "";
  const sectionId = first.section_id ? String(first.section_id) : null;
  const classResultsQuery = supabase.from("published_student_result_summary")
    .select("student_id,total_marks,total_max_marks")
    .eq("school_id", schoolId).eq("exam_id", examId)
    .eq("class_id", String(first.class_id));
  const [{ data: boundaryRows, error: boundaryError }, { data: classResults, error: classResultsError }] = await Promise.all([
    scaleId
      ? supabase.from("grade_boundaries").select("grade,min_percentage,max_percentage").eq("grading_scale_id", scaleId).order("min_percentage", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    sectionId ? classResultsQuery.eq("section_id", sectionId) : classResultsQuery.is("section_id", null),
  ]);
  if (boundaryError || classResultsError) {
    console.error("Report card grade boundaries or class positions could not be loaded.", boundaryError ?? classResultsError);
    return <main className="school-document-page"><p className="student-error">Report card summary could not be loaded. Refresh and try again.</p></main>;
  }

  const marks = rows as unknown as ReportMark[];
  const boundaries = (boundaryRows ?? []) as GradeBoundary[];
  const summary = calculateReportCardSummary(marks, boundaries);
  const position = getStudentPosition(
    (classResults ?? []).map((result) => ({
      student_id: result.student_id,
      percentage: Number(result.total_max_marks) > 0
        ? (Number(result.total_marks) / Number(result.total_max_marks)) * 100
        : 0,
    })),
    studentId,
  );
  const fullName = [first.first_name, first.middle_name, first.last_name].filter(Boolean).join(" ");
  const studentIdentifier = String(first.student_identifier ?? first.admission_number ?? "—");
  const className = String(first.class_name ?? "—");
  const sectionName = String(first.section_name ?? "—");
  const status = summary.passed ? "PASS" : "NEEDS IMPROVEMENT";

  return <main className="school-document-page">
    <div className="school-document-toolbar no-print">
      <Link href={`/results/${examId}`}>Back to student results</Link>
      <PrintAction autoPrint={print === "1"} label="Print report card / Save PDF" />
    </div>
    <SchoolDocument school={school} className="school-document--report-card" title="Student report card" reference={String(exam.name)}>
      <section className="report-card-student">
        <div>
          <p className="school-document__section-title">Student information</p>
          <h2>{fullName || "Student"}</h2>
          <p>Student ID: <strong>{studentIdentifier}</strong></p>
        </div>
        <div className={`report-card-result report-card-result--${summary.passed ? "pass" : "review"}`}>
          <span>Overall result</span>
          <strong>{status}</strong>
        </div>
      </section>
      <dl className="school-document__facts report-card-facts">
        <div><dt>Class</dt><dd>{className}</dd></div>
        <div><dt>Section</dt><dd>{sectionName}</dd></div>
        <div><dt>Academic session</dt><dd>{examSession?.name ?? "—"}</dd></div>
        <div><dt>Exam period</dt><dd>{String(exam.starts_on)} – {String(exam.ends_on)}</dd></div>
      </dl>
      <h3 className="school-document__section-title">Subject results</h3>
      <div className="student-table-wrap">
        <table className="school-document__table">
          <thead><tr><th>Subject</th><th>Marks</th><th>Pass mark</th><th>Percentage</th><th>Grade</th><th>Result</th><th>Teacher remark</th></tr></thead>
          <tbody>{rows.map((row) => {
            const passingMarks = getEffectivePassingMarks(
              String(row.maximum_marks),
              row.passing_marks === null ? null : String(row.passing_marks),
            );
            const subjectPassed = Number(row.obtained_marks) >= passingMarks;
            return <tr key={String(row.exam_subject_id)}>
              <td><strong>{String(row.subject_name)}</strong>{row.subject_code ? <small>{String(row.subject_code)}</small> : null}</td>
              <td>{formatMarks(row.obtained_marks)}/{formatMarks(row.maximum_marks)}</td>
              <td>{formatMarks(passingMarks)}{row.passing_marks === null ? " (40%)" : ""}</td>
              <td>{Number(row.percentage).toFixed(2)}%</td>
              <td>{String(row.grade ?? "—")}</td>
              <td>{subjectPassed ? "Pass" : "Fail"}</td>
              <td><span className="report-card-remark">{String(row.remarks ?? "—")}</span></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <dl className="school-document__totals report-card-totals">
        <div><dt>Total marks</dt><dd>{formatMarks(summary.totalObtained)} / {formatMarks(summary.totalMaximum)}</dd></div>
        <div><dt>Overall percentage</dt><dd>{summary.percentage.toFixed(2)}%</dd></div>
        <div><dt>Overall grade</dt><dd>{summary.grade ?? "—"}</dd></div>
        <div className="is-emphasis"><dt>Class position</dt><dd>{position ? `${position}${position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th"}` : "—"}</dd></div>
      </dl>
      <p className="school-document__notice">This report card reflects the marks approved and published by the school.</p>
      <div className="school-document__signatures report-card-signatures">
        <span>Class teacher</span>
        <span>Principal / Head</span>
        <span>Parent / Guardian</span>
      </div>
    </SchoolDocument>
  </main>;
}
