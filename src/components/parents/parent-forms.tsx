"use client";

import { useActionState } from "react";

import { addRelationship, removeRelationship, saveParent, updateOwnParent } from "@/app/actions/parents";
import type { ParentFormState } from "@/lib/parents/schemas";
import { SubmitButton } from "@/components/auth/submit-button";

type ParentRecord = Record<string, string | null | undefined>;
function Feedback({ state }: { state: ParentFormState | undefined }) { return <>{state?.error && <p className="student-error">{state.error}</p>}{state?.success && <p className="student-success">{state.success}</p>}</>; }
function Field({ label, name, type = "text", value, required = false }: { label: string; name: string; type?: string; value?: string | null; required?: boolean }) { return <label className="student-field">{label}<input name={name} type={type} defaultValue={value ?? ""} required={required} /></label>; }

export function ParentForm({ parent, self = false }: { parent?: ParentRecord; self?: boolean }) {
  const [state, action] = useActionState(self ? updateOwnParent : saveParent, undefined);
  return <form action={action} className="student-form"><Feedback state={state} />{parent?.id && !self && <input type="hidden" name="id" value={parent.id} />}<div className="student-form-grid"><Field label="First name" name="firstName" value={parent?.first_name} required /><Field label="Last name" name="lastName" value={parent?.last_name} required /><Field label="Relationship" name="relationship" value={parent?.relationship} /><Field label="Phone" name="phone" value={parent?.phone} /><Field label="Email" name="email" type="email" value={parent?.email} /><label className="student-field student-field-wide">Address<textarea name="address" defaultValue={parent?.address ?? ""} rows={3} /></label><Field label="Emergency contact" name="emergencyContactName" value={parent?.emergency_contact_name} /><Field label="Emergency phone" name="emergencyContactPhone" value={parent?.emergency_contact_phone} />{!self && <Field label="Auth profile ID (optional)" name="profileId" value={parent?.profile_id} />}</div><SubmitButton>{parent?.id ? "Save parent" : "Create parent"}</SubmitButton></form>;
}

export function RelationshipForm({ parentId, students }: { parentId: string; students: Array<{ id: string; first_name: string; last_name: string }> }) { const [state, action] = useActionState(addRelationship, undefined); return <form action={action} className="student-form"><Feedback state={state} /><input type="hidden" name="parentId" value={parentId} /><div className="student-form-grid"><label className="student-field">Student<select name="studentId" required><option value="">Select student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name}</option>)}</select></label><label className="student-field">Relationship<select name="relationship" defaultValue="guardian"><option value="father">Father</option><option value="mother">Mother</option><option value="guardian">Guardian</option><option value="other">Other</option></select></label><label className="student-field">Primary guardian<label className="checkbox-field"><input type="checkbox" name="isPrimary" /> Set as primary</label></label></div><SubmitButton>Add child relationship</SubmitButton></form>; }

export function RemoveRelationshipForm({ parentId, studentId }: { parentId: string; studentId: string }) { const [state, action] = useActionState(removeRelationship, undefined); return <form action={action} className="delete-form"><input type="hidden" name="parentId" value={parentId} /><input type="hidden" name="studentId" value={studentId} /><button type="submit">Remove</button>{state?.error && <span className="student-error">{state.error}</span>}</form>; }