"use client";
import { useActionState } from "react";
import { saveCurriculum, saveTeacherSubject } from "@/app/actions/curriculum";
import { SubmitButton } from "@/components/auth/submit-button";
import type { CurriculumFormState } from "@/lib/curriculum/schemas";
type Option = { id: string; name: string };
function Feedback({ state }: { state: CurriculumFormState | undefined }) { return <>{state?.error && <p className="student-error">{state.error}</p>}{state?.success && <p className="student-success">{state.success}</p>}</>; }
function Select({ label, name, options, defaultValue }: { label: string; name: string; options: Option[]; defaultValue?: string }) { return <label className="curriculum-form__field">{label}<select name={name} required defaultValue={defaultValue ?? ""}><option value="">Select {label.toLowerCase()}</option>{options.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>; }
export function CurriculumForm({ sessions, classes, subjects, defaultSessionId }: { sessions: Option[]; classes: Option[]; subjects: Option[]; defaultSessionId?: string }) {
  const [state, action] = useActionState(saveCurriculum, undefined);
  return <form action={action} className="curriculum-form">
    <Feedback state={state} />
    <div className="curriculum-form__grid">
      <Select label="Academic session" name="academicSessionId" options={sessions} defaultValue={defaultSessionId} />
      <Select label="Class" name="classId" options={classes} />
      <Select label="Subject" name="subjectId" options={subjects} />
      <label className="curriculum-form__field">Credits <span>(optional)</span><input name="credits" type="number" min="0" step="0.01" placeholder="e.g. 4" /></label>
      <label className="curriculum-form__field">Grading weight <span>(optional)</span><div className="curriculum-form__input-suffix"><input name="gradingWeight" type="number" min="0" max="100" step="0.01" placeholder="e.g. 25" /><span>%</span></div></label>
      <label className="curriculum-form__field">Mapping status<select name="status" defaultValue="active"><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option></select></label>
    </div>
    <div className="curriculum-form__footer"><p>A session-specific class and subject mapping. Existing mappings remain unchanged.</p><SubmitButton>Add curriculum mapping</SubmitButton></div>
  </form>;
}
export function TeacherSubjectForm({ sessions, teachers, subjects, classes, defaultSessionId, defaultClassId }: { sessions: Option[]; teachers: Option[]; subjects: Option[]; classes: Option[]; defaultSessionId?: string; defaultClassId?: string }) {
  const [state, action] = useActionState(saveTeacherSubject, undefined);
  return <form action={action} className="curriculum-form">
    <Feedback state={state} />
    <div className="curriculum-form__grid curriculum-form__grid--teacher">
      <Select label="Academic session" name="academicSessionId" options={sessions} defaultValue={defaultSessionId} />
      <Select label="Teacher" name="teacherId" options={teachers} />
      <Select label="Subject" name="subjectId" options={subjects} />
      <label className="curriculum-form__field">Class <span>(optional)</span><select name="classId" defaultValue={defaultClassId ?? ""}><option value="">All classes</option>{classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
    </div>
    <div className="curriculum-form__footer"><p>Assign an active teacher to this subject for the selected session.</p><SubmitButton>Assign teacher</SubmitButton></div>
  </form>;
}