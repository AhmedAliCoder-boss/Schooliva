"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { reviewEmployeeVerificationDocument, updateEmployeeVerification } from "@/app/actions/hrm";
import { SubmitButton } from "@/components/auth/submit-button";
import type { HrmFormState } from "@/lib/hrm/schemas";

type EmployeeType = "teacher" | "staff";
type DocumentType = "profile_photo" | "national_id" | "qualification" | "experience" | "police_verification";
export type EmployeeDocumentOption = { id: string; type: EmployeeType; label: string };

function Feedback({ state }: { state: HrmFormState | undefined }) {
  return <>
    {state?.error && <p className="student-error" role="alert">{state.error}</p>}
    {state?.success && <p className="student-success" role="status">{state.success}</p>}
  </>;
}

export function EmployeeVerificationUploadForm({
  employeeId,
  employeeType,
  documentType,
  employeeOptions,
}: {
  employeeId?: string;
  employeeType?: EmployeeType;
  documentType?: DocumentType;
  employeeOptions?: EmployeeDocumentOption[];
}) {
  const [state, action] = useActionState(updateEmployeeVerification, undefined);
  const isPhoto = documentType === "profile_photo";
  const [selectedEmployee, setSelectedEmployee] = useState(
    employeeOptions?.[0] ? `${employeeOptions[0].type}:${employeeOptions[0].id}` : `${employeeType ?? "teacher"}:${employeeId ?? ""}`,
  );
  const [selectedType, selectedId] = selectedEmployee.split(":");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (state?.success && previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
      setPreviewUrl(null);
    }
  }, [state]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const file = event.currentTarget.files?.[0];
    const nextPreviewUrl = file ? URL.createObjectURL(file) : null;
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
  }

  return <form action={action} className="hrm-verification-upload-form">
    {employeeOptions
      ? <>
          <label>Employee
            <select
              value={selectedEmployee}
              onChange={(event) => setSelectedEmployee(event.currentTarget.value)}
              required
            >
              {employeeOptions.map((employee) => <option key={`${employee.type}:${employee.id}`} value={`${employee.type}:${employee.id}`}>{employee.label}</option>)}
            </select>
          </label>
          <input type="hidden" name="employeeId" value={selectedId ?? ""} />
          <input type="hidden" name="employeeType" value={selectedType ?? ""} />
        </>
      : <>
          <input type="hidden" name="employeeId" value={employeeId ?? ""} />
          <input type="hidden" name="employeeType" value={employeeType ?? ""} />
        </>}
    {documentType
      ? <input type="hidden" name="documentType" value={documentType} />
      : <label>Document type
          <select name="documentType" defaultValue="national_id" required>
            <option value="national_id">National ID / CNIC</option>
            <option value="qualification">Qualification certificate</option>
            <option value="experience">Experience document</option>
            <option value="police_verification">Police verification</option>
          </select>
        </label>}
    <label>{isPhoto ? "Choose a photo" : "Choose a file"}
      <input
        name="document"
        type="file"
        accept={isPhoto ? "image/jpeg,image/png,image/webp" : ".pdf,image/jpeg,image/png,image/webp"}
        onChange={isPhoto ? handlePhotoChange : undefined}
        required
      />
    </label>
    {isPhoto && previewUrl && <div className="hrm-photo-upload-preview">
      <Image src={previewUrl} alt="Selected employee photo preview" width={144} height={144} unoptimized />
      <span>Photo preview</span>
    </div>}
    <small>{isPhoto ? "JPG, PNG or WebP" : "PDF, JPG, PNG or WebP"} · one file per upload · maximum 5 MB</small>
    <Feedback state={state} />
    <SubmitButton>{isPhoto ? "Save photo" : "Upload document"}</SubmitButton>
  </form>;
}

export function EmployeeVerificationReviewForm({
  employeeId,
  employeeType,
  documentId,
  status,
}: {
  employeeId: string;
  employeeType: EmployeeType;
  documentId: string;
  status: "pending" | "verified" | "rejected";
}) {
  const [state, action] = useActionState(reviewEmployeeVerificationDocument, undefined);
  return <form action={action} className="hrm-verification-review-form">
    <input type="hidden" name="employeeId" value={employeeId} />
    <input type="hidden" name="employeeType" value={employeeType} />
    <input type="hidden" name="documentId" value={documentId} />
    <label>
      <span>Verification</span>
      <select name="status" defaultValue={status}>
        <option value="pending">Pending review</option>
        <option value="verified">Verified</option>
        <option value="rejected">Needs replacement</option>
      </select>
    </label>
    <Feedback state={state} />
    <SubmitButton>Save status</SubmitButton>
  </form>;
}
