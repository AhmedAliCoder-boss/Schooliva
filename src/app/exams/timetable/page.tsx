import Link from "next/link";

import { ExamTimetableBuilder } from "@/components/exams/exam-timetable-builder";
import { requireExamContext } from "@/lib/exams/context";

type SearchParams = Promise<{ examId?: string; classId?: string; sectionId?: string }>;

function relation<T>(value: unknown): T | null {
  return Array.isArray(value) ? (value[0] ?? null) as T | null : value as T | null;
}

export default async function ExamTimetablePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, schoolId } = await requireExamContext("view");
  const [
    { data: exams, error: examsError },
    { data: terms, error: termsError },
    { data: classes, error: classesError },
    { data: sections, error: sectionsError },
    { data: subjects, error: subjectsError },
    { data: examiners, error: examinersError },
    { data: schedules, error: schedulesError },
    { data: canManage, error: permissionError },
  ] = await Promise.all([
    supabase.from("exams").select("id,name,academic_session_id,starts_on,ends_on,status,academic_sessions(name)")
      .eq("school_id", schoolId).order("starts_on", { ascending: false }),
    supabase.from("academic_terms").select("id,name,academic_session_id,starts_on,ends_on")
      .eq("school_id", schoolId).order("starts_on"),
    supabase.from("classes").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("sections").select("id,name,class_id").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("exam_subjects").select("id,exam_id,class_id,subject_id,subjects(name)")
      .eq("school_id", schoolId).order("created_at"),
    supabase.from("teachers").select("id,first_name,last_name").eq("school_id", schoolId)
      .eq("employment_status", "active").eq("is_active", true).is("deleted_at", null).order("last_name"),
    supabase.from("exam_schedules")
      .select("id,exam_subject_id,section_id,academic_term_id,examiner_teacher_id,scheduled_on,starts_at,ends_at,room,sections(name),academic_terms(name),teachers(first_name,last_name),exam_subjects(exam_id,class_id,subjects(name),classes(name),exams(name))")
      .eq("school_id", schoolId).order("scheduled_on", { ascending: true }).order("starts_at", { ascending: true }).limit(300),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "exams", target_action: "manage" }),
  ]);
  const dataError = examsError ?? termsError ?? classesError ?? sectionsError ?? subjectsError ?? examinersError ?? schedulesError ?? permissionError;
  if (dataError) {
    console.error("Exam timetable page data could not be loaded.", dataError);
    return <main className="timetable-shell"><p className="auth-error">Exam timetable could not be loaded. Refresh and try again.</p></main>;
  }

  const examRows = (exams ?? []).filter((exam) => exam.status === "draft");
  const draftExamIds = examRows.map((exam) => exam.id);
  const { data: sectionWorkflows, error: workflowsError } = draftExamIds.length
    ? await supabase.from("exam_section_workflows").select("exam_id,section_id,status")
      .eq("school_id", schoolId).in("exam_id", draftExamIds)
    : { data: [], error: null };
  if (workflowsError) {
    console.error("Exam section progress could not be loaded for the timetable builder.", workflowsError);
    return <main className="timetable-shell"><p className="auth-error">Exam section progress could not be loaded. Refresh and try again.</p></main>;
  }
  const lockedSections = (sectionWorkflows ?? []).map((workflow) => `${workflow.exam_id}:${workflow.section_id}`);
  const termRows = terms ?? [];
  const classRows = classes ?? [];
  const sectionRows = sections ?? [];
  const subjectRows = (subjects ?? []).map((item: {
    id: string;
    exam_id: string;
    class_id: string;
    subject_id: string;
    subjects: unknown;
  }) => ({
    id: item.id,
    exam_id: item.exam_id,
    class_id: item.class_id,
    subject_id: item.subject_id,
    name: relation<{ name: string }>(item.subjects)?.name ?? "Subject",
  }));
  const examinerRows = (examiners ?? []).map((item) => ({
    id: item.id,
    name: `${item.first_name} ${item.last_name}`.trim(),
  }));
  const examNames = new Map(examRows.map((exam) => [exam.id, exam.name]));
  const classNames = new Map(classRows.map((item) => [item.id, item.name]));
  const initialExamId = examRows.some((exam) => exam.id === params.examId) ? params.examId : "";
  const initialClassId = classRows.some((item) => item.id === params.classId)
    && subjectRows.some((subject) => subject.exam_id === initialExamId && subject.class_id === params.classId)
    ? params.classId
    : "";
  const initialSectionId = sectionRows.some((section) => section.id === params.sectionId && section.class_id === initialClassId)
    ? params.sectionId
    : "";

  return (
    <main className="timetable-shell exam-timetable-shell">
      <header className="students-header timetable-header">
        <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
        <nav aria-label="Exam timetable navigation">
          <Link className="text-action" href="/exams">Exams</Link>
          <Link className="text-action" href="/timetable">Class lessons</Link>
          <Link className="text-action" href="/dashboard">Dashboard</Link>
        </nav>
      </header>
      <section className="students-heading timetable-heading">
        <div><p className="eyebrow">Assessment planning</p><h1>Exam timetable</h1><p>Schedule exams by class, section, academic term, and examiner.</p></div>
        <div className="timetable-heading__summary"><strong>{schedules?.length ?? 0}</strong><span>scheduled papers</span></div>
      </section>

      {canManage === true && <section className="setup-card timetable-builder">
        <div className="timetable-section-heading">
          <div><p className="eyebrow">Build a schedule</p><h2>Schedule an exam paper</h2></div>
          <span>Exam dates must fall inside both the exam and academic term.</span>
        </div>
        {!examRows.length
          ? <div className="timetable-prerequisite"><p>Create a draft exam and add its class subjects before scheduling papers.</p><Link href="/exams">Go to Exams</Link></div>
          : !termRows.length || !examinerRows.length || !subjectRows.length || !classRows.length || !sectionRows.length
            ? <div className="timetable-prerequisite"><p>Set up active classes and sections, add exam subjects and academic terms, and ensure active teachers are available as examiners.</p></div>
            : <ExamTimetableBuilder
                exams={examRows.map(({ id, name, academic_session_id, starts_on, ends_on }) => ({ id, name, academic_session_id, starts_on, ends_on }))}
                terms={termRows}
                classes={classRows}
                sections={sectionRows}
                subjects={subjectRows}
                examiners={examinerRows}
                lockedSections={lockedSections}
                initialExamId={initialExamId}
                initialClassId={initialClassId}
                initialSectionId={initialSectionId}
              />}
      </section>}

      <section className="timetable-schedule-panel">
        <div className="timetable-toolbar"><div><p className="eyebrow">Schedule register</p><h2>Scheduled exam papers</h2><p className="timetable-toolbar__description">Review exam day, class section, term, subject, and assigned examiner.</p></div></div>
        {schedules?.length ? <div className="setup-table-wrap timetable-table-wrap">
          <table className="student-table timetable-table exam-schedule-register">
            <thead><tr><th>Exam</th><th>Term</th><th>Date / time</th><th>Class / section</th><th>Subject</th><th>Examiner</th><th>Room</th></tr></thead>
            <tbody>{schedules.map((schedule) => {
              const examSubject = relation<{ exam_id: string; class_id: string; subjects?: unknown; classes?: unknown; exams?: unknown }>(schedule.exam_subjects);
              const subject = relation<{ name: string }>(examSubject?.subjects);
              const cls = relation<{ name: string }>(examSubject?.classes);
              const section = relation<{ name: string }>(schedule.sections);
              const term = relation<{ name: string }>(schedule.academic_terms);
              const examiner = relation<{ first_name: string; last_name: string }>(schedule.teachers);
              return <tr key={schedule.id}>
                <td><Link className="student-name" href={`/exams/${examSubject?.exam_id ?? ""}`}><strong>{examNames.get(examSubject?.exam_id ?? "") ?? relation<{ name: string }>(examSubject?.exams)?.name ?? "Exam"}</strong><small>Open exam workflow</small></Link></td>
                <td>{term?.name ?? "—"}</td>
                <td><strong>{schedule.scheduled_on}</strong><small>{String(schedule.starts_at).slice(0, 5)}–{String(schedule.ends_at).slice(0, 5)}</small></td>
                <td><strong>{classNames.get(examSubject?.class_id ?? "") ?? cls?.name ?? "Class"}</strong><small>{section?.name ?? "Section"}</small></td>
                <td>{subject?.name ?? "—"}</td>
                <td>{examiner ? `${examiner.first_name} ${examiner.last_name}`.trim() : "—"}</td>
                <td>{schedule.room ?? "—"}</td>
              </tr>;
            })}</tbody>
          </table>
        </div> : <div className="timetable-empty"><h3>No exam papers scheduled yet</h3><p>Select an exam, class, section, term, and examiner above to start the exam timetable.</p></div>}
      </section>
    </main>
  );
}
