import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintAction } from "@/components/print/print-action";
import { SchoolDocument } from "@/components/print/school-document";
import { getSchoolDocumentIdentity } from "@/lib/print/school-document";
import { requireExamContext } from "@/lib/exams/context";

function relation<T>(value: unknown): T | null {
  return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null;
}

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ classId?: string; sectionId?: string }>;
type PrintRow = Record<string, unknown>;

export default async function ExamTimetablePrintPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const filters = await searchParams;
  const { supabase, schoolId } = await requireExamContext("view");
  const [{ data: exam, error: examError }, { data: subjects, error: subjectsError }, school] = await Promise.all([
    supabase.from("exams")
      .select("id,name,starts_on,ends_on,status,exam_types(name),academic_sessions(name)")
      .eq("id", id).eq("school_id", schoolId).maybeSingle(),
    supabase.from("exam_subjects")
      .select("id,class_id,classes(name),subjects(name)")
      .eq("exam_id", id).eq("school_id", schoolId).order("created_at"),
    getSchoolDocumentIdentity(supabase, schoolId),
  ]);
  if (examError || subjectsError) {
    console.error("Exam timetable print data could not be loaded.", examError ?? subjectsError);
    return <main className="school-document-page"><p className="auth-error">Exam timetable could not be loaded. Refresh and try again.</p></main>;
  }
  if (!exam) notFound();

  const subjectRows = (subjects ?? []) as unknown as PrintRow[];
  const subjectIds = subjectRows.map((subject) => String(subject.id));
  const { data: schedules, error: schedulesError } = subjectIds.length
    ? await supabase.from("exam_schedules")
      .select("id,scheduled_on,starts_at,ends_at,room,section_id,academic_term_id,examiner_teacher_id,sections(id,name,class_id),academic_terms(name),teachers(first_name,last_name),exam_subjects(class_id,classes(name),subjects(name))")
      .in("exam_subject_id", subjectIds).eq("school_id", schoolId)
      .order("scheduled_on").order("starts_at")
    : { data: [], error: null };
  if (schedulesError) {
    console.error("Exam schedule could not be loaded for printing.", schedulesError);
    return <main className="school-document-page"><p className="auth-error">Exam schedule could not be loaded. Refresh and try again.</p></main>;
  }

  const allRows = (schedules ?? []) as unknown as PrintRow[];
  const classes = [...new Map(allRows.map((row) => {
    const subject = relation<{ class_id?: string; classes?: unknown }>(row.exam_subjects);
    const cls = relation<{ name: string }>(subject?.classes);
    return subject?.class_id ? [String(subject.class_id), { id: String(subject.class_id), name: cls?.name ?? "Class" }] as const : null;
  }).filter((item): item is readonly [string, { id: string; name: string }] => item !== null))].map(([, item]) => item)
    .sort((a, b) => a.name.localeCompare(b.name));
  const selectedClass = classes.find((item) => item.id === filters.classId);
  const sectionPairs = allRows
    .filter((row) => !selectedClass || String(relation<{ class_id?: string }>(row.exam_subjects)?.class_id) === selectedClass.id)
    .map((row) => {
      const section = relation<{ id: string; name: string }>(row.sections);
      return section ? [section.id, section] as const : null;
    })
    .filter((item): item is readonly [string, { id: string; name: string }] => item !== null);
  const visibleSections = [...new Map(sectionPairs).values()].sort((a, b) => a.name.localeCompare(b.name));
  const selectedSection = visibleSections.find((section) => section.id === filters.sectionId);
  const visibleRows = allRows.filter((row) => {
    const section = relation<{ id: string; name: string }>(row.sections);
    const subject = relation<{ class_id?: string; classes?: unknown; subjects?: unknown }>(row.exam_subjects);
    return (!selectedClass || String(subject?.class_id) === selectedClass.id)
      && (!selectedSection || section?.id === selectedSection.id);
  });
  const examType = relation<{ name: string }>(exam.exam_types);
  const session = relation<{ name: string }>(exam.academic_sessions);

  return (
    <main className="school-document-page exam-timetable-print-page">
      <div className="school-document-toolbar no-print">
        <Link href={`/exams/${id}`}>Back to exam</Link>
        <PrintAction label="Print exam timetable / Save PDF" />
      </div>
      <form className="exam-print-filters no-print" action={`/exams/${id}/print`} method="get">
        <label>Class
          <select name="classId" defaultValue={selectedClass?.id ?? ""}>
            <option value="">All classes</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>Section
          <select name="sectionId" defaultValue={selectedSection?.id ?? ""}>
            <option value="">All sections</option>
            {visibleSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
          </select>
        </label>
        <button type="submit">Apply filters</button>
      </form>
      <SchoolDocument
        className="school-document--exam-timetable"
        school={school}
        title="Exam timetable"
        reference={String(exam.name)}
      >
        <div className="exam-print-heading">
          <h2>{String(exam.name)}</h2>
          <p>{examType?.name ?? "Exam"} · {session?.name ?? "Academic session"} · {String(exam.starts_on)} to {String(exam.ends_on)}</p>
          <strong>{selectedClass?.name ?? "All classes"}{selectedSection ? ` · ${selectedSection.name}` : ""}</strong>
        </div>
        {visibleRows.length ? <div className="student-table-wrap">
          <table className="school-document__table">
            <thead><tr><th>Date</th><th>Time</th><th>Term</th><th>Class</th><th>Section</th><th>Subject</th><th>Examiner</th><th>Room</th></tr></thead>
            <tbody>{visibleRows.map((row) => {
              const subject = relation<{ class_id?: string; classes?: unknown; subjects?: unknown }>(row.exam_subjects);
              const cls = relation<{ name: string }>(subject?.classes);
              const subjectName = relation<{ name: string }>(subject?.subjects);
              const section = relation<{ id: string; name: string }>(row.sections);
              const term = relation<{ name: string }>(row.academic_terms);
              const examiner = relation<{ first_name: string; last_name: string }>(row.teachers);
              return <tr key={String(row.id)}>
                <td>{String(row.scheduled_on)}</td>
                <td>{String(row.starts_at).slice(0, 5)}–{String(row.ends_at).slice(0, 5)}</td>
                <td>{term?.name ?? "—"}</td>
                <td>{cls?.name ?? "—"}</td>
                <td>{section?.name ?? "—"}</td>
                <td>{subjectName?.name ?? "—"}</td>
                <td>{examiner ? `${examiner.first_name} ${examiner.last_name}`.trim() : "—"}</td>
                <td>{String(row.room ?? "—")}</td>
              </tr>;
            })}</tbody>
          </table>
        </div> : <div className="student-empty"><h3>No scheduled exams found</h3><p>Add schedules or adjust the selected class and section filters.</p></div>}
      </SchoolDocument>
    </main>
  );
}
