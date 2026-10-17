"use client";

import { useActionState, useState } from "react";
import { issueCertificate } from "@/app/actions/documents";
import { SubmitButton } from "@/components/auth/submit-button";
import type { DocumentFormState } from "@/lib/documents/schemas";

type Option = { id: string; name: string };
function Feedback({ state }: { state: DocumentFormState | undefined }) { return <>{state?.error && <p className="student-error">{state.error}</p>}{state?.success && <p className="student-success">{state.success}</p>}</>; }
export function CertificateForm({ students }: { students: Option[] }) {
  const [state, action] = useActionState(issueCertificate, undefined);
  const [certificateType, setCertificateType] = useState("");
  const autoNumbered = certificateType === "character" || certificateType === "leaving";
  return <form action={action} className="student-form">
    <Feedback state={state} />
    <div className="student-form-grid">
      <label className="student-field">Student<select name="studentId" required><option value="">Select student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
      <label className="student-field">Certificate type<select name="certificateType" value={certificateType} onChange={(event) => setCertificateType(event.target.value)} required><option value="">Select certificate type</option><option value="bonafide">Bonafide certificate</option><option value="enrollment">Enrollment certificate</option><option value="character">Character certificate</option><option value="leaving">Leaving certificate</option></select></label>
      {autoNumbered
        ? <p className="student-field">Certificate number<span>Generated automatically as the next four-digit number. Requires approval before issue.</span></p>
        : certificateType && <label className="student-field">Certificate number<input name="certificateNumber" placeholder="Enter the school certificate number" required /></label>}
      <label className="student-field">Issued on<input name="issuedOn" type="date" required /></label>
      <label className="student-field student-field-wide">Content / remarks<textarea name="content" rows={4} /></label>
    </div>
    {(certificateType === "bonafide" || certificateType === "enrollment") && <p className="student-muted">Requires an active student enrollment. Student class, section, session, and roll number will be saved on the certificate.</p>}
    <SubmitButton>{autoNumbered ? "Request certificate approval" : "Issue certificate"}</SubmitButton>
  </form>;
}
