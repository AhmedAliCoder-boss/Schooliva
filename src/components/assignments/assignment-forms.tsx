"use client";

import { useActionState, useState } from "react";
import { changeAssignmentStatus, createAssignment, submitAssignment, gradeAssignmentSubmission } from "@/app/actions/assignments";
import { SubmitButton } from "@/components/auth/submit-button";
import type { AssignmentFormState } from "@/lib/assignments/schemas";

type Option = { id: string; name: string };

export type AssignmentSectionOption = Option & { class_id: string };

function Feedback({ state }: { state: AssignmentFormState | undefined }) {
  return <>{state?.error && <p className="student-error" role="alert">{state.error}</p>}{state?.success && <p className="student-success" role="status">{state.success}</p>}</>;
}

export function AssignmentForm({
  sessions,
  classes,
  sections,
  subjects,
  teachers,
  defaultSessionId,
  today,
}: {
  sessions: Option[];
  classes: Option[];
  sections: AssignmentSectionOption[];
  subjects: Option[];
  teachers: Option[];
  defaultSessionId: string;
  today: string;
}) {
  const [state, action] = useActionState(createAssignment, undefined);
  const [classId, setClassId] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const filteredSections = sections.filter((section) => section.class_id === classId);

  return <form action={action} className="student-form assignment-create-form">
    <Feedback state={state} />
    <div className="assignment-create-form__intro">
      <strong>Assignment details</strong>
      <span>Set clear instructions, ownership, and a due date for one class section.</span>
    </div>
    <div className="student-form-grid">
      <label className="student-field">Academic session
        <select name="academicSessionId" required defaultValue={defaultSessionId}>
          <option value="">Select academic session</option>{sessions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="student-field">Class
        <select name="classId" value={classId} required onChange={(event) => setClassId(event.target.value)}>
          <option value="">Select class</option>{classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="student-field">Section
        <select name="sectionId" key={classId} required disabled={!classId || filteredSections.length === 0} defaultValue="">
          <option value="">{!classId ? "Select class first" : filteredSections.length ? "Select section" : "No active sections"}</option>
          {filteredSections.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="student-field">Subject
        <select name="subjectId" required defaultValue="">
          <option value="">Select subject</option>{subjects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="student-field">Assign teacher
        <select name="teacherId" required defaultValue="">
          <option value="">Select teacher</option>{teachers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="student-field assignment-create-form__title">Assignment title
        <input name="title" required maxLength={160} placeholder="e.g. Fractions practice" />
      </label>
      <label className="student-field">Issue date
        <input name="issueDate" type="date" required value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
      </label>
      <label className="student-field">Due date
        <input key={issueDate} name="dueDate" type="date" required min={issueDate || today} defaultValue={issueDate || today} />
      </label>
      <label className="student-field">Maximum marks <span className="assignment-field-note">Optional</span>
        <input name="maxMarks" type="number" min="0" max="999.99" step="0.01" placeholder="e.g. 20" />
      </label>
      <label className="student-field student-field-wide">Instructions
        <textarea name="description" rows={4} maxLength={5000} placeholder="Explain the task, expected format, and any resources students should use." />
      </label>
    </div>
    {(!sessions.length || !classes.length || !sections.length || !subjects.length || !teachers.length)
      && <p className="assignment-prerequisite">
        {!sessions.length ? "Create an academic session. " : ""}
        {!classes.length || !sections.length ? "Add an active class and section. " : ""}
        {!subjects.length ? "Add an active subject. " : ""}
        {!teachers.length ? "Add an active teacher before assigning work." : ""}
      </p>}
    <div className="assignment-create-form__footer">
      <span>Students can submit until the deadline. Late work is clearly marked for review.</span>
      <SubmitButton disabled={!sessions.length || !classes.length || !sections.length || !subjects.length || !teachers.length}>Publish assignment</SubmitButton>
    </div>
  </form>;
}

export function SubmissionForm({ assignmentId, initialContent = "" }: { assignmentId: string; initialContent?: string }) {
  const [state, action] = useActionState(submitAssignment, undefined);
  return <form action={action} className="student-form assignment-inline-form">
    <Feedback state={state} />
    <input type="hidden" name="assignmentId" value={assignmentId} />
    <label className="student-field">Your response
      <textarea name="content" rows={4} maxLength={5000} defaultValue={initialContent} placeholder="Write your answer or tell your teacher where to find your work." />
    </label>
    <SubmitButton>Submit work</SubmitButton>
  </form>;
}

export function ReviewForm({
  submissionId,
  marks,
  feedback,
  maxMarks,
}: {
  submissionId: string;
  marks: number | null;
  feedback: string | null;
  maxMarks: number | null;
}) {
  const [state, action] = useActionState(gradeAssignmentSubmission, undefined);
  return <form action={action} className="assignment-review-form">
    <Feedback state={state} />
    <input type="hidden" name="submissionId" value={submissionId} />
    <label className="student-field">Marks{maxMarks !== null && <span className="assignment-field-note">Out of {maxMarks}</span>}
      <input name="marks" type="number" min="0" max={maxMarks ?? undefined} step="0.01" defaultValue={marks ?? ""} />
    </label>
    <label className="student-field">Feedback
      <textarea name="feedback" rows={3} maxLength={2000} defaultValue={feedback ?? ""} placeholder="A short note for the student (optional if marks are entered)." />
    </label>
    <SubmitButton>Save review</SubmitButton>
  </form>;
}

export function AssignmentStatusForm({ assignmentId, status }: { assignmentId: string; status: string }) {
  const [state, action] = useActionState(changeAssignmentStatus, undefined);
  const nextStatus = status === "open" ? "closed" : "open";
  return <form action={action} className="assignment-status-form">
    <input type="hidden" name="assignmentId" value={assignmentId} />
    <input type="hidden" name="status" value={nextStatus} />
    <SubmitButton>{status === "open" ? "Close submissions" : status === "draft" ? "Publish assignment" : "Reopen submissions"}</SubmitButton>
    {state?.error && <span className="student-error" role="alert">{state.error}</span>}
    {state?.success && <span className="student-success" role="status">{state.success}</span>}
  </form>;
}
