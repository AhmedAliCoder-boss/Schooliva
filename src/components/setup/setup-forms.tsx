"use client";

import { useActionState } from "react";

import { assignSubject, bootstrapSchool, createClass, createSection, createSession, createSubject, createTerm, deleteSetupRecord, updateSchool, updateSettings, type SetupFormState } from "@/app/actions/setup";

import { SubmitButton } from "@/components/auth/submit-button";

function Feedback({ state }: { state: SetupFormState | undefined }) {
  return <>{state?.error && <p className="setup-error">{state.error}</p>}{state?.success && <p className="setup-success">{state.success}</p>}</>;
}

function Field({ label, name, type = "text", defaultValue, required = true, placeholder }: { label: string; name: string; type?: string; defaultValue?: string; required?: boolean; placeholder?: string }) {
  return <label className="setup-field">{label}<input name={name} type={type} defaultValue={defaultValue} required={required} placeholder={placeholder} /></label>;
}

export function BootstrapSchoolForm() {
  const [state, action] = useActionState(bootstrapSchool, undefined);
  return <form action={action} className="setup-form"><Feedback state={state} /><div className="form-grid"><Field label="School name" name="name" placeholder="Greenfield Academy" /><Field label="Slug" name="slug" placeholder="greenfield-academy" /><Field label="School code" name="code" placeholder="GFA" /><Field label="Email" name="email" type="email" required={false} /><Field label="Phone" name="phone" required={false} /><Field label="Timezone" name="timezone" defaultValue="UTC" /><Field label="Currency" name="currency" defaultValue="USD" /></div><SubmitButton>Create school</SubmitButton></form>;
}

export function SchoolProfileForm({ school }: { school: Record<string, string | null> }) {
  const [state, action] = useActionState(updateSchool, undefined);
  return <form action={action} className="setup-form"><Feedback state={state} /><div className="form-grid"><Field label="School name" name="name" defaultValue={school.name ?? ""} /><Field label="Slug" name="slug" defaultValue={school.slug ?? ""} /><Field label="School code" name="code" defaultValue={school.code ?? ""} /><Field label="Email" name="email" type="email" defaultValue={school.email ?? ""} required={false} /><Field label="Phone" name="phone" defaultValue={school.phone ?? ""} required={false} /><Field label="Website" name="website" type="url" defaultValue={school.website ?? ""} required={false} /></div><label className="setup-field setup-field-wide">Address<textarea name="address" defaultValue={school.address ?? ""} rows={3} /></label><SubmitButton>Save school profile</SubmitButton></form>;
}

export function SettingsForm({ settings }: { settings: Record<string, string | null> }) {
  const [state, action] = useActionState(updateSettings, undefined);
  return <form action={action} className="setup-form"><Feedback state={state} /><div className="form-grid"><Field label="Timezone" name="timezone" defaultValue={settings.timezone ?? "UTC"} /><Field label="Currency" name="currency" defaultValue={settings.currency_code ?? "USD"} /><Field label="Date format" name="dateFormat" defaultValue={settings.date_format ?? "YYYY-MM-DD"} /></div><SubmitButton>Save settings</SubmitButton></form>;
}

export function SessionForm({ initial }: { initial?: Record<string, string> }) {
  const [state, action] = useActionState(createSession, undefined);
  return <form action={action} className="setup-form"><Feedback state={state} />{initial?.id && <input type="hidden" name="id" value={initial.id} />}<div className="form-grid"><Field label="Session name" name="name" defaultValue={initial?.name} placeholder="2026 - 2027" /><Field label="Code" name="code" defaultValue={initial?.code} placeholder="2026-27" /><Field label="Starts" name="startsOn" type="date" defaultValue={initial?.starts_on} /><Field label="Ends" name="endsOn" type="date" defaultValue={initial?.ends_on} /><label className="setup-field">Status<select name="status" defaultValue={initial?.status ?? "draft"}><option value="draft">Draft</option><option value="active">Active</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label></div><SubmitButton>{initial?.id ? "Update session" : "Add session"}</SubmitButton></form>;
}

export function TermForm({ sessions, initial }: { sessions: Array<{ id: string; name: string }>; initial?: Record<string, string> }) {
  const [state, action] = useActionState(createTerm, undefined);
  return <form action={action} className="setup-form"><Feedback state={state} />{initial?.id && <input type="hidden" name="id" value={initial.id} />}<div className="form-grid"><label className="setup-field setup-field-wide">Academic session<select name="academicSessionId" defaultValue={initial?.academic_session_id} required><option value="">Select session</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label><Field label="Term name" name="name" defaultValue={initial?.name} placeholder="Term 1" /><Field label="Code" name="code" defaultValue={initial?.code} placeholder="T1" /><Field label="Starts" name="startsOn" type="date" defaultValue={initial?.starts_on} /><Field label="Ends" name="endsOn" type="date" defaultValue={initial?.ends_on} /><label className="setup-field">Status<select name="status" defaultValue={initial?.status ?? "draft"}><option value="draft">Draft</option><option value="active">Active</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label></div><SubmitButton>{initial?.id ? "Update term" : "Add term"}</SubmitButton></form>;
}

export function ClassForm({ initial }: { initial?: Record<string, string> }) {
  const [state, action] = useActionState(createClass, undefined);
  return <form action={action} className="setup-form"><Feedback state={state} />{initial?.id && <input type="hidden" name="id" value={initial.id} />}<div className="form-grid"><Field label="Class name" name="name" defaultValue={initial?.name} placeholder="Class 10" /><Field label="Code" name="code" defaultValue={initial?.code} placeholder="10" /><label className="setup-field setup-field-wide">Description<textarea name="description" defaultValue={initial?.description} rows={3} /></label><label className="setup-field">Status<select name="status" defaultValue={initial?.status ?? "active"}><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option></select></label></div><SubmitButton>{initial?.id ? "Update class" : "Add class"}</SubmitButton></form>;
}

export function SectionForm({ classes, teachers, initial }: { classes: Array<{ id: string; name: string }>; teachers: Array<{ id: string; first_name: string; last_name: string }>; initial?: Record<string, string> }) {
  const [state, action] = useActionState(createSection, undefined);
  return <form action={action} className="setup-form"><Feedback state={state} />{initial?.id && <input type="hidden" name="id" value={initial.id} />}<div className="form-grid"><label className="setup-field">Class<select name="classId" defaultValue={initial?.class_id} required><option value="">Select class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><Field label="Section name" name="name" defaultValue={initial?.name} placeholder="Section A" /><Field label="Code" name="code" defaultValue={initial?.code} placeholder="A" /><Field label="Capacity" name="capacity" type="number" defaultValue={initial?.capacity} required={false} /><label className="setup-field">Class teacher<select name="classTeacherId" defaultValue={initial?.class_teacher_id ?? ""}><option value="">Not assigned</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.first_name} {teacher.last_name}</option>)}</select></label><label className="setup-field">Status<select name="status" defaultValue={initial?.status ?? "active"}><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option></select></label></div><SubmitButton>{initial?.id ? "Update section" : "Add section"}</SubmitButton></form>;
}

export function SubjectForm({ initial }: { initial?: Record<string, string> }) {
  const [state, action] = useActionState(createSubject, undefined);
  return <form action={action} className="setup-form"><Feedback state={state} />{initial?.id && <input type="hidden" name="id" value={initial.id} />}<div className="form-grid"><Field label="Subject name" name="name" defaultValue={initial?.name} placeholder="Mathematics" /><Field label="Code" name="code" defaultValue={initial?.code} placeholder="MATH" /><label className="setup-field">Type<select name="subjectType" defaultValue={initial?.subject_type ?? "core"}><option value="core">Core</option><option value="elective">Elective</option><option value="optional">Optional</option><option value="co_curricular">Co-curricular</option></select></label><label className="setup-field">Status<select name="status" defaultValue={initial?.status ?? "active"}><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option></select></label></div><SubmitButton>{initial?.id ? "Update subject" : "Add subject"}</SubmitButton></form>;
}

export function AssignmentForm({ classes, subjects }: { classes: Array<{ id: string; name: string }>; subjects: Array<{ id: string; name: string }> }) {
  const [state, action] = useActionState(assignSubject, undefined);
  return <form action={action} className="setup-form"><Feedback state={state} /><div className="form-grid"><label className="setup-field">Class<select name="classId" required><option value="">Select class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="setup-field">Subject<select name="subjectId" required><option value="">Select subject</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><SubmitButton>Assign subject</SubmitButton></form>;
}

export function DeleteRecordForm({ table, id }: { table: string; id: string }) {
  const [state, action] = useActionState(deleteSetupRecord, undefined);
  return <form action={action} className="delete-form"><input type="hidden" name="table" value={table} /><input type="hidden" name="id" value={id} /><button type="submit" title="Delete">Remove</button>{state?.error && <span className="setup-error">{state.error}</span>}</form>;
}