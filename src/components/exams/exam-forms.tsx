"use client";
import { useActionState, useState } from "react";
import type { KeyboardEvent } from "react";
import Link from "next/link";
import { addGradeBoundary, changeExamSectionStatus, createExam, removeExamSchedule, removeExamSubject, saveExamSchedule, saveExamSubject, saveExamType, saveGradingScale, submitMarks } from "@/app/actions/exams";
import { SubmitButton } from "@/components/auth/submit-button";
import type { ExamFormState } from "@/lib/exams/schemas";
type Option = { id: string; name: string };
function Feedback({ state }: { state: ExamFormState | undefined }) { return <>{state?.error && <p className="student-error">{state.error}</p>}{state?.success && <p className="student-success">{state.success}</p>}</>; }
function Select({ label, name, options, required = true, allowNone = false }: { label: string; name: string; options: Option[]; required?: boolean; allowNone?: boolean }) { return <label className="student-field">{label}<select name={name} required={required}><option value="">{allowNone ? "No grading scale" : `Select ${label.toLowerCase()}`}</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>; }
function TextField({ label, name, type = "text", placeholder, required = true }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) { return <label className="student-field">{label}<input name={name} type={type} placeholder={placeholder} required={required} /></label>; }

export function ExamSubjectForm({ examId, classes, subjects }: {
  examId: string;
  classes: Option[];
  subjects: Option[];
}) {
  const [state, action] = useActionState(saveExamSubject, undefined);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  return <details className="exam-content-drawer" open={!classes.length}>
    <summary>
      <span><strong>Add class content</strong><small>Choose any school subject and add it to this class&apos;s exam.</small></span>
      <span className="exam-content-drawer__toggle" aria-hidden="true">⌄</span>
    </summary>
    <form action={action} className="student-form">
      <Feedback state={state} />
      <input type="hidden" name="examId" value={examId} />
      <div className="student-form-grid">
        <label className="student-field">Class
          <select name="classId" value={classId} required onChange={(event) => { setClassId(event.target.value); setSubjectId(""); }}>
            <option value="">Select class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="student-field">Subject
          <select name="subjectId" value={subjectId} required disabled={!classId || !subjects.length} onChange={(event) => setSubjectId(event.target.value)}>
            <option value="">{!classId ? "Select class first" : subjects.length ? "Select school subject" : "No school subjects available"}</option>
            {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <TextField label="Maximum marks" name="maximumMarks" type="number" />
        <TextField label="Passing marks (optional)" name="passingMarks" type="number" required={false} />
      </div>
      <p className="exams-inline-hint">Leave passing marks blank to use the default 40% of maximum marks.</p>
      {!classes.length
        ? <p className="exams-inline-hint">No active classes are available. Add a class in School Setup.</p>
        : !subjects.length
          ? <p className="exams-inline-hint">Create active subjects in <Link href="/setup?section=subjects">School Setup → Subjects</Link>.</p>
          : classId
            ? <p className="exams-inline-hint">Subjects are shared across the school. Adding one here also makes it available to this class in School Setup.</p>
          : null}
      <SubmitButton disabled={!classes.length || !subjects.length}>Add subject</SubmitButton>
    </form>
  </details>;
}

export function RemoveExamSubject({ id, examId }: { id: string; examId: string }) { const [state, action] = useActionState(removeExamSubject, undefined); return <form action={action} className="delete-form"><input type="hidden" name="id" value={id} /><input type="hidden" name="examId" value={examId} /><button type="submit">Remove</button>{state?.error && <span className="student-error">{state.error}</span>}</form>; }

export function ExamScheduleForm({ examId, examSubjects, sections, terms, examiners }: {
  examId: string;
  examSubjects: Array<Option & { classId: string }>;
  sections: Array<Option & { class_id: string }>;
  terms: Option[];
  examiners: Option[];
}) {
  const [state, action] = useActionState(saveExamSchedule, undefined);
  const [examSubjectId, setExamSubjectId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const selectedSubject = examSubjects.find((subject) => subject.id === examSubjectId);
  const classSections = sections.filter((section) => section.class_id === selectedSubject?.classId);

  return <form action={action} className="student-form">
    <Feedback state={state} />
    <input type="hidden" name="examId" value={examId} />
    <div className="student-form-grid">
      <label className="student-field">Exam subject
        <select name="examSubjectId" value={examSubjectId} required onChange={(event) => {
          setExamSubjectId(event.target.value);
          setSectionId("");
        }}>
          <option value="" disabled>Select exam subject</option>
          {examSubjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="student-field">Section
        <select name="sectionId" value={classSections.some((section) => section.id === sectionId) ? sectionId : ""}
          required disabled={!selectedSubject || !classSections.length} onChange={(event) => setSectionId(event.target.value)}>
          <option value="" disabled>{selectedSubject ? "Select section" : "Select exam subject first"}</option>
          {classSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
        </select>
      </label>
      <Select label="Academic term" name="academicTermId" options={terms} />
      <Select label="Examiner" name="examinerTeacherId" options={examiners} />
      <TextField label="Scheduled on" name="scheduledOn" type="date" />
      <TextField label="Starts at" name="startsAt" type="time" />
      <TextField label="Ends at" name="endsAt" type="time" />
      <TextField label="Room (optional)" name="room" required={false} />
    </div>
    <SubmitButton>Add schedule</SubmitButton>
  </form>;
}

export function RemoveExamSchedule({ id, examId }: { id: string; examId: string }) { const [state, action] = useActionState(removeExamSchedule, undefined); return <form action={action} className="delete-form"><input type="hidden" name="id" value={id} /><input type="hidden" name="examId" value={examId} /><button type="submit">Remove</button>{state?.error && <span className="student-error">{state.error}</span>}</form>; }

type MarkStudent = { id: string; studentIdentifier: string; name: string; maximumMarks: number; existing?: { obtainedMarks?: number | null; grade?: string | null; remarks?: string | null } };

export function MarksRosterFilter({
  action,
  subjects,
  sections,
  selectedSubjectId,
  selectedSectionId,
}: {
  action: string;
  subjects: Array<Option & { classId: string }>;
  sections: Array<Option & { classId: string; className: string; status: string }>;
  selectedSubjectId: string;
  selectedSectionId: string;
}) {
  const [subjectId, setSubjectId] = useState(selectedSubjectId);
  const [sectionId, setSectionId] = useState(selectedSectionId);
  const selectedSection = sections.find((section) => section.id === sectionId);
  const classSubjects = subjects.filter((subject) => subject.classId === selectedSection?.classId);

  return <form className="attendance-filters" action={action} method="get">
    <label>Scheduled section
      <select name="markSectionId" value={sectionId} required onChange={(event) => {
        setSectionId(event.target.value);
        setSubjectId("");
      }}>
        <option value="">Select a section submitted for marking</option>
        {sections.map((section) => <option key={section.id} value={section.id}>{section.name} · {section.className} · {section.status}</option>)}
      </select>
    </label>
    <label>Exam subject
      <select name="subject" value={classSubjects.some((subject) => subject.id === subjectId) ? subjectId : ""}
        required disabled={!selectedSection} onChange={(event) => setSubjectId(event.target.value)}>
        <option value="">{selectedSection ? "Select a subject in this section" : "Select section first"}</option>
        {classSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
      </select>
    </label>
    <button type="submit">Load student roster</button>
  </form>;
}

export function MarksEntryForm({ examId, examSubjectId, sectionId, students, editable }: { examId: string; examSubjectId: string; sectionId: string; students: MarkStudent[]; editable: boolean }) {
  const [state, action] = useActionState(submitMarks, undefined);
  const [records, setRecords] = useState(students.map((student) => ({ studentId: student.id, obtainedMarks: String(student.existing?.obtainedMarks ?? ""), grade: student.existing?.grade ?? "", remarks: student.existing?.remarks ?? "" })));
  const update = (studentId: string, field: "obtainedMarks" | "grade" | "remarks", value: string) => setRecords((current) => current.map((record) => record.studentId === studentId ? { ...record, [field]: value } : record));
  const moveMarkFocus = (form: HTMLFormElement, current: HTMLInputElement | null, rowDelta: number, columnDelta: number) => {
    const row = current ? Number(current.dataset.markRow) : 0;
    const column = current ? Number(current.dataset.markColumn) : 0;
    const nextRow = row + rowDelta;
    const nextColumn = column + columnDelta;
    const nextInput = form.querySelector<HTMLInputElement>(
      `[data-mark-navigation="true"][data-mark-row="${nextRow}"][data-mark-column="${nextColumn}"]:not(:disabled)`,
    );
    nextInput?.focus();
  };
  const handleMarkNavigation = (event: KeyboardEvent<HTMLInputElement>) => {
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      Enter: [1, 0],
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    if (event.currentTarget.form) {
      moveMarkFocus(event.currentTarget.form, event.currentTarget, direction[0], direction[1]);
    }
  };
  const payload = records
    .filter((record) => record.obtainedMarks !== "")
    .map((record) => ({ studentId: record.studentId, obtainedMarks: Number(record.obtainedMarks), grade: record.grade, remarks: record.remarks }));
  return <form action={action} className="attendance-marker">
    <input type="hidden" name="examId" value={examId} />
    <input type="hidden" name="examSubjectId" value={examSubjectId} />
    <input type="hidden" name="sectionId" value={sectionId} />
    <input type="hidden" name="records" value={JSON.stringify(payload)} />
    {state?.error && <p className="student-error" role="alert">{state.error}</p>}
    {state?.success && <p className="student-success" role="status">{state.success}</p>}
    <div className="attendance-toolbar">
      <span>{students.length} enrolled students</span>
      {!editable && <span>Read only</span>}
    </div>
    <div className="attendance-table-wrap"><table className="student-table"><thead><tr><th>Student</th><th>Student ID</th><th>Obtained</th><th>Max</th><th>Grade (auto if blank)</th><th>Remarks</th></tr></thead><tbody>
      {students.map((student, rowIndex) => {
        const record = records.find((item) => item.studentId === student.id) ?? { studentId: student.id, obtainedMarks: "", grade: "", remarks: "" };
        return <tr key={student.id}>
          <td><strong>{student.name}</strong></td><td><strong>{student.studentIdentifier}</strong></td>
          <td><input
            type="number"
            min="0"
            max={student.maximumMarks}
            step="0.01"
            disabled={!editable}
            data-mark-navigation="true"
            data-mark-row={rowIndex}
            data-mark-column={0}
            value={record.obtainedMarks}
            onChange={(event) => update(student.id, "obtainedMarks", event.target.value)}
            onKeyDown={handleMarkNavigation}
          /></td>
          <td>{student.maximumMarks}</td>
          <td><input
            aria-label={`Grade for ${student.name}`}
            maxLength={20}
            disabled={!editable}
            data-mark-navigation="true"
            data-mark-row={rowIndex}
            data-mark-column={1}
            value={record.grade}
            onChange={(event) => update(student.id, "grade", event.target.value)}
            onKeyDown={handleMarkNavigation}
          /></td>
          <td><input
            aria-label={`Remarks for ${student.name}`}
            disabled={!editable}
            data-mark-navigation="true"
            data-mark-row={rowIndex}
            data-mark-column={2}
            value={record.remarks}
            onChange={(event) => update(student.id, "remarks", event.target.value)}
            onKeyDown={handleMarkNavigation}
          /></td>
        </tr>;
      })}
    </tbody></table></div>
    {editable && <div className="exam-marks-actions"><span>{payload.length} of {students.length} scores ready to save; blank rows are left unchanged.</span><SubmitButton disabled={!payload.length}>Save entered marks</SubmitButton></div>}
  </form>;
}

export function ExamForm({ types, sessions, scales }: { types: Option[]; sessions: Option[]; scales: Option[] }) {
  const [state, action] = useActionState(createExam, undefined);
  const [startsOn, setStartsOn] = useState("");
  return <form action={action} className="student-form">
    <Feedback state={state} />
    <div className="student-form-grid">
      <Select label="Exam type" name="examTypeId" options={types} />
      <Select label="Academic session" name="academicSessionId" options={sessions} />
      <Select label="Grading scale (optional)" name="gradingScaleId" options={scales} required={false} allowNone />
      <TextField label="Exam name" name="name" />
      <label className="student-field">Starts<input name="startsOn" type="date" required value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></label>
      <label className="student-field">Ends<input name="endsOn" type="date" required min={startsOn || undefined} /></label>
    </div>
    <SubmitButton disabled={!types.length || !sessions.length}>Create exam</SubmitButton>
  </form>;
}

export function ExamSectionWorkflowForm({
  examId,
  sectionId,
  status,
  readyToSubmit,
}: {
  examId: string;
  sectionId: string;
  status: string;
  readyToSubmit: boolean;
}) {
  const [state, action] = useActionState(changeExamSectionStatus, undefined);
  const stages: Record<string, { next: string; label: string; hint: string }> = {
    draft: {
      next: "submitted",
      label: "Submit section for marking",
      hint: readyToSubmit ? "This section has every scheduled paper." : "Schedule every exam subject in this section before submitting it.",
    },
    submitted: { next: "reviewed", label: "Complete section review", hint: "Enter marks for every enrolled student in this section before review." },
    reviewed: { next: "published", label: "Publish section results", hint: "Publishing locks this section's results." },
    published: { next: "published", label: "Section published", hint: "This section's results are final and read-only." },
  };
  const stage = stages[status] ?? stages.draft;
  return <form action={action} className="exam-status-action">
    <input type="hidden" name="examId" value={examId} />
    <input type="hidden" name="sectionId" value={sectionId} />
    <input type="hidden" name="nextStatus" value={stage.next} />
    <p>{stage.hint}</p>
    <button className="table-edit" disabled={status === "published" || (status === "draft" && !readyToSubmit)} type="submit">{stage.label}</button>
    {state?.error && <p className="student-error" role="alert">{state.error}</p>}
    {state?.success && <p className="student-success" role="status">{state.success}</p>}
  </form>;
}

export function ExamTypeForm() { const [state, action] = useActionState(saveExamType, undefined); return <form action={action} className="student-form"><Feedback state={state} /><div className="student-form-grid"><TextField label="Exam type name" name="name" placeholder="Monthly Test" /><TextField label="Description (optional)" name="description" required={false} /></div><SubmitButton>Add exam type</SubmitButton></form>; }

export function GradingScaleForm() { const [state, action] = useActionState(saveGradingScale, undefined); return <form action={action} className="student-form"><Feedback state={state} /><div className="student-form-grid"><TextField label="Scale name" name="name" placeholder="Standard (A-F)" /><TextField label="Description (optional)" name="description" required={false} /></div><SubmitButton>Add grading scale</SubmitButton></form>; }

export function GradeBoundaryForm({ gradingScaleId }: { gradingScaleId: string }) { const [state, action] = useActionState(addGradeBoundary, undefined); return <form action={action} className="student-form"><Feedback state={state} /><input type="hidden" name="gradingScaleId" value={gradingScaleId} /><div className="student-form-grid"><TextField label="Grade" name="grade" placeholder="A" /><TextField label="Min %" name="minPercentage" type="number" /><TextField label="Max %" name="maxPercentage" type="number" /><TextField label="Grade point (optional)" name="gradePoint" type="number" required={false} /><TextField label="Remark (optional)" name="remark" required={false} /></div><SubmitButton>Add grade boundary</SubmitButton></form>; }