import Link from "next/link";
import { notFound } from "next/navigation";

import { ExamContentFilter } from "@/components/exams/exam-content-filter";
import { ExamSectionWorkflowForm, ExamSubjectForm, MarksEntryForm, MarksRosterFilter, RemoveExamSchedule, RemoveExamSubject } from "@/components/exams/exam-forms";
import { requireExamContext } from "@/lib/exams/context";
import { getExamWorkflowProgress, getFullyScheduledSectionIds, type ExamSectionWorkflowStatus } from "@/lib/exams/schedule-coverage";
import { getEffectivePassingMarks } from "@/lib/results/report-card";

function relation<T>(value: unknown): T | null {
  return Array.isArray(value) ? (value[0] ?? null) as T | null : value as T | null;
}

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ subject?: string; classId?: string; sectionId?: string; markSectionId?: string }>;
type Row = Record<string, unknown>;

const workflow = [
  { id: "draft", title: "Plan", description: "Schedule papers for every active section." },
  { id: "submitted", title: "Mark", description: "Mark each section independently." },
  { id: "reviewed", title: "Review", description: "Review all marks in each section." },
  { id: "published", title: "Publish", description: "Complete only when every section is published." },
];

export default async function ExamDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, schoolId } = await requireExamContext("view");
  const [
    { data: exam, error: examError },
    { data: subjectRows, error: subjectError },
    { data: classRows, error: classError },
    { data: activeSectionRows, error: sectionsError },
    { data: subjectCatalog, error: catalogError },
    { data: canManageExams, error: examPermissionError },
    { data: canManageGrading, error: gradingPermissionError },
  ] = await Promise.all([
    supabase.from("exams").select("id,name,starts_on,ends_on,status,academic_session_id,exam_types(name),academic_sessions(name),grading_scales(name)").eq("id", id).eq("school_id", schoolId).maybeSingle(),
    supabase.from("exam_subjects").select("id,maximum_marks,passing_marks,class_id,classes(name),subjects(name,code)").eq("exam_id", id).eq("school_id", schoolId).order("created_at"),
    supabase.from("classes").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("sections").select("id,name,class_id").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("subjects").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "exams", target_action: "manage" }),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "grading", target_action: "manage" }),
  ]);
  if (examError) {
    console.error("Exam details could not be loaded.", examError);
    return <main className="students-shell"><p className="auth-error">This exam could not be loaded. Refresh and try again.</p></main>;
  }
  if (!exam) notFound();
  const dataError = subjectError ?? classError ?? sectionsError ?? catalogError ?? examPermissionError ?? gradingPermissionError;
  if (dataError) {
    console.error("Exam workflow data could not be loaded.", dataError);
    return <main className="students-shell"><p className="auth-error">The exam workflow could not be loaded. Refresh and try again.</p></main>;
  }

  const record = exam as unknown as Row;
  const subjects = (subjectRows ?? []) as Row[];
  const sections = (activeSectionRows ?? []) as Row[];
  const subjectIds = subjects.map((item) => String(item.id));
  const { data: scheduleRows, error: scheduleError } = subjectIds.length
    ? await supabase.from("exam_schedules")
      .select("id,exam_subject_id,section_id,scheduled_on,starts_at,ends_at,room,sections(name),academic_terms(name),teachers(first_name,last_name),exam_subjects(subjects(name),classes(name))")
      .in("exam_subject_id", subjectIds).eq("school_id", schoolId).order("scheduled_on").order("starts_at")
    : { data: [], error: null };
  if (scheduleError) {
    console.error("Exam timetable could not be loaded.", scheduleError);
    return <main className="students-shell"><p className="auth-error">The exam timetable could not be loaded. Refresh and try again.</p></main>;
  }

  const schedules = (scheduleRows ?? []) as Row[];
  const { data: sectionWorkflowRows, error: sectionWorkflowError } = await supabase.from("exam_section_workflows")
    .select("section_id,status").eq("exam_id", id).eq("school_id", schoolId);
  if (sectionWorkflowError) {
    console.error("Exam section workflow could not be loaded.", sectionWorkflowError);
    return <main className="students-shell"><p className="auth-error">Section marking progress could not be loaded. Refresh and try again.</p></main>;
  }
  const sectionWorkflow = new Map((sectionWorkflowRows ?? []).map((item) => [String(item.section_id), String(item.status)]));
  const fullyScheduledSectionIds = getFullyScheduledSectionIds(
    subjects.map((subject) => ({ id: String(subject.id), class_id: String(subject.class_id) })),
    sections.map((section) => ({ id: String(section.id), class_id: String(section.class_id) })),
    schedules.map((schedule) => ({ exam_subject_id: String(schedule.exam_subject_id), section_id: String(schedule.section_id) })),
  );
  const selectedClassId = query.classId && classRows?.some((item) => item.id === query.classId) ? query.classId : "";
  const selectedSectionId = query.sectionId && sections.some((item) => item.id === query.sectionId && item.class_id === selectedClassId)
    ? query.sectionId
    : "";
  const contentClasses = (classRows ?? []).filter((item) =>
    (!selectedClassId || item.id === selectedClassId) && subjects.some((subject) => subject.class_id === item.id));
  const examSubjects = subjects.map((item) => ({
    id: String(item.id),
    classId: String(item.class_id),
    name: `${relation<{ name: string }>(item.subjects)?.name ?? "Subject"} · ${relation<{ name: string }>(item.classes)?.name ?? "Class"}`,
  }));
  const examType = relation<{ name: string }>(record.exam_types);
  const session = relation<{ name: string }>(record.academic_sessions);
  const scale = relation<{ name: string }>(record.grading_scales);
  const status = String(record.status);
  const published = status === "published";
  const draft = status === "draft";
  const examClassIds = new Set(subjects.map((subject) => String(subject.class_id)));
  const examSections = sections.filter((section) => examClassIds.has(String(section.class_id)));
  const workflowProgress = getExamWorkflowProgress(
    examSections.map((section) => String(section.id)),
    (sectionWorkflowRows ?? []).map((item) => ({
      section_id: String(item.section_id),
      status: String(item.status) as ExamSectionWorkflowStatus,
    })),
  );
  const sectionProgressCounts = [
    { stage: "submitted", count: workflowProgress.submitted },
    { stage: "reviewed", count: workflowProgress.reviewed },
    { stage: "published", count: workflowProgress.published },
  ];
  const hasSectionWorkflow = sectionWorkflow.size > 0;
  const canEditExamContent = draft && !hasSectionWorkflow;
  const hasMarkingSections = sectionProgressCounts.some((item) => item.count > 0);
  const unpublishedSectionCount = workflowProgress.total - workflowProgress.published;
  const queriedSubject = subjects.find((item) => String(item.id) === query.subject);
  const markingSections = sections.filter((section) =>
    fullyScheduledSectionIds.has(String(section.id))
    && ["submitted", "reviewed", "published"].includes(sectionWorkflow.get(String(section.id)) ?? ""));
  const selectedMarkSection = markingSections.find((section) => String(section.id) === query.markSectionId);
  const selectedSubject = queriedSubject && selectedMarkSection
    && String(queriedSubject.class_id) === String(selectedMarkSection.class_id)
    ? queriedSubject
    : undefined;
  let students: Array<{ id: string; studentIdentifier: string; name: string; maximumMarks: number; existing?: { obtainedMarks?: number | null; grade?: string | null; remarks?: string | null } }> = [];
  let marksLoadError: string | null = null;

  if (query.subject && selectedSubject && selectedMarkSection) {
    const [{ data: enrollments, error: enrollmentError }, { data: existingMarks, error: marksError }] = await Promise.all([
      supabase.from("student_enrollments").select("student_id,students(first_name,middle_name,last_name,student_identifier)")
        .eq("school_id", schoolId).eq("class_id", String(selectedSubject.class_id))
        .eq("section_id", String(selectedMarkSection.id))
        .eq("academic_session_id", String(record.academic_session_id)).eq("status", "active"),
      supabase.from("marks").select("student_id,obtained_marks,grade,remarks")
        .eq("school_id", schoolId).eq("exam_subject_id", String(selectedSubject.id)),
    ]);
    if (enrollmentError || marksError) {
      console.error("Student roster or exam marks could not be loaded.", enrollmentError ?? marksError);
      marksLoadError = "Student roster or marks could not be loaded. Refresh and try again.";
    } else {
      const markLookup = new Map((existingMarks ?? []).map((mark) => [String(mark.student_id), mark]));
      students = (enrollments ?? []).map((enrollment) => {
        const student = relation<{ first_name: string; middle_name?: string | null; last_name: string; student_identifier: string }>(enrollment.students);
        const mark = markLookup.get(String(enrollment.student_id));
        return {
          id: String(enrollment.student_id),
          studentIdentifier: student?.student_identifier ?? "—",
          name: `${student?.first_name ?? ""} ${student?.middle_name ?? ""} ${student?.last_name ?? ""}`.trim(),
          maximumMarks: Number(selectedSubject.maximum_marks ?? 0),
          existing: mark ? { obtainedMarks: mark.obtained_marks, grade: mark.grade, remarks: mark.remarks } : undefined,
        };
      });
    }
  }

  return (
    <main className="students-shell exams-workspace exam-detail-workspace">
      <header className="students-header">
        <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
        <nav aria-label="Exam navigation">
          <Link className="text-action" href="/exams">All exams</Link>
          <Link className="text-action" href="/exams/timetable">Exam timetable</Link>
          <Link className="text-action" href="/dashboard">Dashboard</Link>
        </nav>
      </header>

      <section className="student-profile-heading exams-detail-heading">
        <div><p className="eyebrow">Assessment workspace · {examType?.name ?? "Exam"}</p>
          <h1>{String(record.name)}</h1>
          <p>{session?.name ?? "Academic session"} · {String(record.starts_on)} – {String(record.ends_on)}{scale ? ` · ${scale.name}` : ""}</p>
        </div>
        <span className={`status-pill ${status}`}>{draft ? "pending" : status}</span>
      </section>

      <section aria-label="Exam workflow stages" className="exam-detail-workflow">
        {workflow.map((stage, index) => {
          const currentIndex = workflow.findIndex((item) => item.id === status);
          const stageState = index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
          return <article className={`exam-detail-workflow__stage is-${stageState}`} key={stage.id} aria-current={stageState === "current" ? "step" : undefined}>
            <span className="exam-detail-workflow__number">{stageState === "complete" ? "✓" : index + 1}</span>
            <div><strong>{stage.title}</strong><small>{stage.description}</small></div>
          </article>;
        })}
      </section>

      {published && <section className="setup-card exam-next-step">
        <div>
          <p className="eyebrow">Published results</p>
          <h2>Individual student report cards</h2>
          <p>Open each student&apos;s approved result and print a professional report card or save it as a PDF.</p>
        </div>
        <div className="exam-next-step__actions">
          <Link className="exams-primary-link" href={`/results/${id}`}>View student results <span aria-hidden="true">→</span></Link>
        </div>
      </section>}

      {canManageExams === true && !published && <section className="setup-card exam-next-step">
        <div>
          <p className="eyebrow">Next step · {draft ? "Exam setup and section progress" : status === "submitted" ? "Mark entry" : "Results"}</p>
          <h2>{draft ? hasSectionWorkflow ? "Continue each section separately" : "Build and verify the exam timetable" : status === "submitted" ? "Enter student marks" : "Publish reviewed results"}</h2>
          <p>{draft
            ? hasSectionWorkflow
              ? "A section can move through marking while other sections are still being scheduled. The overall exam remains pending until every active section is published."
              : "Add every class subject, then schedule each paper in every active section. Each section can then progress independently."
            : status === "submitted"
              ? "Enter scores and review each section. The overall exam stays submitted until all sections complete review."
              : "Publish each reviewed section. The overall exam is complete only after every active section is published."}</p>
          {examSections.length > 0 && <p className="exams-inline-hint">
            Section progress: {sectionProgressCounts.map((item) => `${item.count} ${item.stage}`).join(" · ")} · {unpublishedSectionCount} not published yet
          </p>}
        </div>
        <div className="exam-next-step__actions">
          {draft && <Link className="exams-primary-link" href={`/exams/timetable?examId=${id}`}>Build exam timetable <span aria-hidden="true">→</span></Link>}
          {hasMarkingSections && examSubjects.length > 0 && <Link className="exams-primary-link" href={`#marks-entry`}>Continue to marks <span aria-hidden="true">↓</span></Link>}
          {schedules.length > 0 && <Link className="text-action" href={`/exams/${id}/print`}>Print timetable</Link>}
        </div>
      </section>}

      <section className="setup-card exam-subjects-section">
        <div className="exams-section-heading">
          <div><p className="eyebrow">Step 1 · Exam content</p><h2>Subjects & marks</h2></div>
          <span>{subjects.length} {subjects.length === 1 ? "subject" : "subjects"} across {contentClasses.length} {contentClasses.length === 1 ? "class" : "classes"}</span>
        </div>
        <ExamContentFilter
          key={`${selectedClassId}:${selectedSectionId}`}
          examId={id}
          classes={classRows ?? []}
          sections={sections.map((item) => ({ id: String(item.id), name: String(item.name), class_id: String(item.class_id) }))}
          initialClassId={selectedClassId}
          initialSectionId={selectedSectionId}
        />
        <p className="exams-inline-hint">Subjects come from the shared school catalog and may be reused across classes. Marks settings are saved per class; blank passing marks use 40% of maximum marks. Each section gets its own paper schedule and examiner.</p>
        {contentClasses.length ? <div className="exam-class-drawers">
          {contentClasses.map((classItem) => {
            const classId = String(classItem.id);
            const classSubjects = subjects.filter((subject) => String(subject.class_id) === classId);
            const classSections = sections.filter((section) =>
              String(section.class_id) === classId && (!selectedSectionId || String(section.id) === selectedSectionId));
            return <details className="exam-class-drawer" key={classId} open={selectedClassId === classId || (!selectedClassId && contentClasses.length === 1)}>
              <summary>
                <span><strong>{String(classItem.name)}</strong><small>{classSubjects.length} {classSubjects.length === 1 ? "subject" : "subjects"} · {sections.filter((section) => String(section.class_id) === classId).length} sections</small></span>
                <span className="exam-content-drawer__toggle" aria-hidden="true">⌄</span>
              </summary>
              <div className="exam-class-drawer__content">
                <div className="student-table-wrap">
                  <table className="student-table">
                    <thead><tr><th>Subject</th><th>Maximum marks</th><th>Passing marks</th>{canManageExams === true && canEditExamContent && <th />}</tr></thead>
                    <tbody>{classSubjects.map((subject) => {
                      const subjectId = String(subject.id);
                      return <tr key={subjectId}>
                        <td><strong>{relation<{ name: string }>(subject.subjects)?.name ?? "—"}</strong><small>{relation<{ name: string; code?: string }>(subject.subjects)?.code ?? ""}</small></td>
                        <td>{String(subject.maximum_marks)}</td>
                        <td>{subject.passing_marks === null
                          ? `${getEffectivePassingMarks(String(subject.maximum_marks), null)} (40% default)`
                          : String(subject.passing_marks)}</td>
                        {canManageExams === true && canEditExamContent && <td><RemoveExamSubject id={subjectId} examId={id} /></td>}
                      </tr>;
                    })}</tbody>
                  </table>
                </div>
                <div className="exam-section-drawers">
                  {classSections.length ? classSections.map((section) => {
                    const sectionId = String(section.id);
                    const sectionSchedules = schedules.filter((schedule) => String(schedule.section_id) === sectionId);
                    const scheduledSubjectIds = new Set(sectionSchedules.map((schedule) => String(schedule.exam_subject_id)));
                    const completeCount = classSubjects.filter((subject) => scheduledSubjectIds.has(String(subject.id))).length;
                    return <details className="exam-section-drawer" key={sectionId} open={selectedSectionId === sectionId}>
                      <summary>
                        <span><strong>{String(section.name)}</strong><small>{completeCount} of {classSubjects.length} papers scheduled</small></span>
                        <span className="exam-content-drawer__toggle" aria-hidden="true">⌄</span>
                      </summary>
                      <div className="exam-section-drawer__content">
                        {classSubjects.map((subject) => {
                          const subjectId = String(subject.id);
                          const scheduled = sectionSchedules.find((schedule) => String(schedule.exam_subject_id) === subjectId);
                          const term = relation<{ name: string }>(scheduled?.academic_terms);
                          const examiner = relation<{ first_name: string; last_name: string }>(scheduled?.teachers);
                          return <div className="exam-section-paper" key={subjectId}>
                            <span><strong>{relation<{ name: string }>(subject.subjects)?.name ?? "Subject"}</strong><small>{scheduled
                              ? `${String(scheduled.scheduled_on)} · ${String(scheduled.starts_at).slice(0, 5)}–${String(scheduled.ends_at).slice(0, 5)}${term ? ` · ${term.name}` : ""}${examiner ? ` · ${examiner.first_name} ${examiner.last_name}` : ""}`
                              : "Not scheduled yet"}</small></span>
                            <span className={scheduled ? "exam-section-paper__status is-scheduled" : "exam-section-paper__status"}>{scheduled ? "Scheduled" : "Pending"}</span>
                          </div>;
                        })}
                        {draft && !sectionWorkflow.has(sectionId) && <Link className="text-action" href={`/exams/timetable?examId=${id}&classId=${classId}&sectionId=${sectionId}`}>Set timetable for this section →</Link>}
                      </div>
                    </details>;
                  }) : <p className="exams-inline-hint">This class has no active sections. Add an active section before building the exam timetable.</p>}
                </div>
              </div>
            </details>;
          })}
        </div> : <div className="student-empty"><h3>{selectedClassId ? "No saved exam content for this class" : "No exam subjects yet"}</h3><p>Add class subjects below. Saved exam content can then be loaded by class and reviewed section by section.</p></div>}
        {canManageExams === true && canEditExamContent
          ? <ExamSubjectForm
              examId={id}
              classes={classRows ?? []}
              subjects={subjectCatalog ?? []}
            />
          : <p className="exams-inline-hint">{canManageExams !== true ? "Only exam managers can change exam subjects." : "Exam subjects are locked after the first section is submitted; finish scheduling the remaining sections."}</p>}
      </section>

      <section className="setup-card exam-schedule-section">
        <div className="exams-section-heading">
          <div><p className="eyebrow">Step 2 · Exam timetable</p><h2>Scheduled papers</h2></div>
          <div className="exam-schedule-actions">
            {canManageExams === true && draft && <Link className="exams-primary-link" href={`/exams/timetable?examId=${id}`}>Open timetable builder <span aria-hidden="true">→</span></Link>}
            {schedules.length > 0 && <Link className="text-action" href={`/exams/${id}/print`}>Print / save PDF</Link>}
          </div>
        </div>
        {subjects.length ? <div className="exam-class-drawers">
          {contentClasses.map((classItem) => {
            const classId = String(classItem.id);
            const classSections = sections.filter((section) => String(section.class_id) === classId);
            const classSubjects = subjects.filter((subject) => String(subject.class_id) === classId);
            return <details className="exam-class-drawer" key={classId} open={selectedClassId === classId || (!selectedClassId && contentClasses.length === 1)}>
              <summary>
                <span><strong>{String(classItem.name)}</strong><small>{classSections.length} sections · {classSubjects.length} papers to schedule in each section</small></span>
                <span className="exam-content-drawer__toggle" aria-hidden="true">⌄</span>
              </summary>
              <div className="exam-class-drawer__content exam-schedule-drawers">
                {classSections.filter((section) => !selectedSectionId || String(section.id) === selectedSectionId).map((section) => {
                  const sectionId = String(section.id);
                  const sectionStatus = sectionWorkflow.get(sectionId) ?? "draft";
                  const sectionSchedules = schedules.filter((schedule) => String(schedule.section_id) === sectionId);
                  const scheduledSubjects = new Set(sectionSchedules.map((schedule) => String(schedule.exam_subject_id))).size;
                  const readyToSubmit = classSubjects.length > 0 && scheduledSubjects === classSubjects.length;
                  return <details className="exam-section-drawer" key={sectionId} open={selectedSectionId === sectionId}>
                    <summary>
                      <span><strong>{String(section.name)}</strong><small>{scheduledSubjects} scheduled {scheduledSubjects === 1 ? "paper" : "papers"} of {classSubjects.length} · {sectionStatus}</small></span>
                      <span className="exam-content-drawer__toggle" aria-hidden="true">⌄</span>
                    </summary>
                    <div className="exam-section-drawer__content">
                      {sectionSchedules.length ? sectionSchedules.map((schedule) => {
                        const subject = relation<{ subjects?: unknown }>(schedule.exam_subjects);
                        const subjectName = relation<{ name: string }>(subject?.subjects);
                        const term = relation<{ name: string }>(schedule.academic_terms);
                        const examiner = relation<{ first_name: string; last_name: string }>(schedule.teachers);
                        return <div className="exam-section-paper" key={String(schedule.id)}>
                          <span><strong>{subjectName?.name ?? "Subject"}</strong><small>{String(schedule.scheduled_on)} · {String(schedule.starts_at).slice(0, 5)}–{String(schedule.ends_at).slice(0, 5)} · {term?.name ?? "Term"} · {examiner ? `${examiner.first_name} ${examiner.last_name}`.trim() : "No examiner"}{schedule.room ? ` · ${String(schedule.room)}` : ""}</small></span>
                          {canManageExams === true && draft && sectionStatus === "draft" && <RemoveExamSchedule id={String(schedule.id)} examId={id} />}
                        </div>;
                      }) : <p className="exams-inline-hint">No papers scheduled for this section yet.</p>}
                      {sectionSchedules.length > 0 && <Link className="exams-primary-link exam-section-print-link" href={`/exams/${id}/print?classId=${classId}&sectionId=${sectionId}`}>Load & print this timetable <span aria-hidden="true">→</span></Link>}
                      {draft && sectionStatus === "draft" && <Link className="text-action" href={`/exams/timetable?examId=${id}&classId=${classId}&sectionId=${sectionId}`}>Open timetable builder →</Link>}
                      {canManageExams === true && !published && <ExamSectionWorkflowForm
                        examId={id}
                        sectionId={sectionId}
                        status={sectionStatus}
                        readyToSubmit={readyToSubmit}
                      />}
                    </div>
                  </details>;
                })}
                {!classSections.length && <p className="exams-inline-hint">Add an active section before building the exam timetable.</p>}
              </div>
            </details>;
          })}
        </div> : <div className="student-empty"><h3>No papers scheduled yet</h3><p>Choose the class, section, academic term, date, and examiner for every subject.</p>
          {canManageExams === true && draft && <Link className="exams-primary-link" href={`/exams/timetable?examId=${id}`}>Start scheduling <span aria-hidden="true">→</span></Link>}
        </div>}
        {!draft && <p className="exams-inline-hint">Each submitted section&apos;s timetable is locked. Other sections progress independently.</p>}
      </section>

      <section className="setup-card exam-marks-section" id="marks-entry">
        <div className="exams-section-heading">
          <div><p className="eyebrow">Step 3 · Grading</p><h2>Marks & review</h2></div>
          <span>{hasMarkingSections ? `${sectionProgressCounts.find((item) => item.stage === "submitted")?.count ?? 0} submitted · section-based marking` : "Available after section submission"}</span>
        </div>
        {!hasMarkingSections ? <div className="student-empty"><h3>Mark entry opens per section</h3><p>Schedule every exam subject in a section and submit that section. The overall exam remains pending until every active section completes publication.</p></div>
          : <>
            {canManageGrading !== true && <p className="exams-inline-hint">You can view the exam workflow, but marks are only available to users with grading access.</p>}
            {canManageGrading === true && <>
              <MarksRosterFilter
                action={`/exams/${id}`}
                subjects={examSubjects}
                sections={markingSections.map((section) => ({
                  id: String(section.id),
                  name: String(section.name),
                  classId: String(section.class_id),
                  className: relation<{ name: string }>(classRows?.find((item) => item.id === section.class_id))?.name ?? "Class",
                  status: sectionWorkflow.get(String(section.id)) ?? "submitted",
                }))}
                selectedSubjectId={selectedSubject ? String(selectedSubject.id) : ""}
                selectedSectionId={selectedMarkSection ? String(selectedMarkSection.id) : ""}
              />
              {marksLoadError ? <p className="student-error" role="alert">{marksLoadError}</p>
                : !markingSections.length ? <p className="exams-inline-hint">No fully scheduled section has been submitted for marking yet.</p>
                  : query.markSectionId && !selectedMarkSection ? <p className="student-error" role="alert">That section is not available for marks in this exam.</p>
                    : query.subject && !queriedSubject ? <p className="student-error" role="alert">That subject does not belong to this exam.</p>
                      : selectedMarkSection && queriedSubject && !selectedSubject ? <p className="student-error" role="alert">That subject does not belong to the selected section.</p>
                      : !selectedMarkSection ? <p className="exams-inline-hint">Select a submitted section, then choose one of its exam subjects.</p>
                      : selectedSubject && students.length ? <MarksEntryForm
                    key={`${String(selectedSubject.id)}:${String(selectedMarkSection?.id)}`}
                    examId={id}
                    examSubjectId={String(selectedSubject.id)}
                    sectionId={String(selectedMarkSection?.id)}
                    students={students}
                    editable={sectionWorkflow.get(String(selectedMarkSection?.id)) === "submitted"}
                  />
                    : selectedSubject && selectedMarkSection ? <div className="student-empty attendance-empty"><h3>No enrolled students</h3><p>No active students are enrolled in this section for the exam session.</p></div>
                      : <div className="student-empty attendance-empty"><h3>Select an exam subject</h3><p>The enrolled student roster and saved marks will load here.</p></div>}
            </>}
          </>}
      </section>
    </main>
  );
}
