"use client";

import { useActionState } from "react";
import { createAssignment, submitAssignment, gradeAssignment } from "@/app/actions/assignments";
import { SubmitButton } from "@/components/auth/submit-button";
import type { AssignmentFormState } from "@/lib/assignments/schemas";

type Option = { id: string; name: string };

function Feedback({ state }: { state: AssignmentFormState | undefined }) { return <>{state?.error && <p className="student-error">{state.error}</p>}{state?.success && <p className="student-success">{state.success}</p>}</>; }
function Select({ label, name, options, required = true }: { label: string; name: string; options: Option[]; required?: boolean }) { return <label className="student-field">{label}<select name={name} required={required}><option value="">Select {label.toLowerCase()}</option>{options.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>; }
export function AssignmentForm({ sessions, classes, sections, subjects }: { sessions: Option[]; classes: Option[]; sections: Option[]; subjects: Option[] }) {
  const [state, action] = useActionState(createAssignment, undefined);
  return <form action={action} className="student-form"><Feedback state={state} /><div className="student-form-grid"><Select label="Academic session" name="academicSessionId" options={sessions} /><Select label="Class" name="classId" options={classes} /><Select label="Section" name="sectionId" options={sections} /><Select label="Subject" name="subjectId" options={subjects} /><label className="student-field">Title<input name="title" required /></label><label className="student-field">Issue date<input name="issueDate" type="date" required /></label><label className="student-field">Due date<input name="dueDate" type="date" required /></label><label className="student-field">Max marks<input name="maxMarks" type="number" min="0" step="0.01" /></label><label className="student-field student-field-wide">Description<textarea name="description" rows={4} /></label></div><SubmitButton>Create assignment</SubmitButton></form>;
}
export function SubmissionForm({ assignmentId }: { assignmentId: string }) {
  const [state, action] = useActionState(submitAssignment, undefined);
  return <form action={action} className="student-form"><Feedback state={state} /><input type="hidden" name="assignmentId" value={assignmentId} /><div className="student-form-grid"><label className="student-field student-field-wide">Submission notes<textarea name="content" rows={4} /></label></div><SubmitButton>Submit assignment</SubmitButton></form>;
}
export function ReviewForm({ assignmentId }: { assignmentId: string }) {
  const [state, action] = useActionState(gradeAssignment, undefined);
  return <form action={action} className="student-form"><Feedback state={state} /><input type="hidden" name="assignmentId" value={assignmentId} /><div className="student-form-grid"><label className="student-field">Marks<input name="marks" type="number" min="0" step="0.01" /></label><label className="student-field student-field-wide">Feedback<textarea name="feedback" rows={4} /></label></div><SubmitButton>Save review</SubmitButton></form>;
}
