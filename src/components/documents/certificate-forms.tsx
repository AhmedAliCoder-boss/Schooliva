"use client";

import { useActionState } from "react";
import { issueCertificate } from "@/app/actions/documents";
import { SubmitButton } from "@/components/auth/submit-button";
import type { DocumentFormState } from "@/lib/documents/schemas";

type Option = { id: string; name: string };
function Feedback({ state }: { state: DocumentFormState | undefined }) { return <>{state?.error && <p className="student-error">{state.error}</p>}{state?.success && <p className="student-success">{state.success}</p>}</>; }
export function CertificateForm({ students }: { students: Option[] }) { const [state, action] = useActionState(issueCertificate, undefined); return <form action={action} className="student-form"><Feedback state={state} /><div className="student-form-grid"><label className="student-field">Student<select name="studentId" required><option value="">Select student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label><label className="student-field">Certificate type<select name="certificateType" required><option value="character">Character certificate</option><option value="bonafide">Bonafide certificate</option><option value="leaving">Leaving certificate</option><option value="enrollment">Enrollment certificate</option></select></label><label className="student-field">Certificate number<input name="certificateNumber" required /></label><label className="student-field">Issued on<input name="issuedOn" type="date" required /></label><label className="student-field student-field-wide">Content / remarks<textarea name="content" rows={4} /></label></div><SubmitButton>Issue certificate</SubmitButton></form>; }
