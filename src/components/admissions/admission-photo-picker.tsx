"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { uploadAdmissionPhoto } from "@/app/actions/admissions";

const maxPhotoSize = 5 * 1024 * 1024;
const allowedPhotoTypes = ["image/jpeg", "image/png", "image/webp"];

export function AdmissionPhotoPicker({
  admissionId,
  applicantName,
  currentPhotoUrl,
  canUpload,
  photoUnavailable,
}: {
  admissionId: string;
  applicantName: string;
  currentPhotoUrl: string | null;
  canUpload: boolean;
  photoUnavailable: boolean;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const displayedPhotoUrl = previewUrl ?? currentPhotoUrl;

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  return (
    <div className="admissions-photo-panel">
      <div className="admissions-photo-preview">
        {displayedPhotoUrl ? (
          <Image
            src={displayedPhotoUrl}
            alt={`${applicantName} applicant photo preview`}
            width={112}
            height={132}
            unoptimized
            className="admissions-applicant-photo"
          />
        ) : (
          <div className="admissions-photo-placeholder" aria-label={photoUnavailable ? "Applicant photo unavailable" : "No applicant photo"}>
            {photoUnavailable ? "Photo unavailable" : "Photo not added"}
          </div>
        )}
        {previewUrl && <span className="admissions-photo-preview__badge">New photo preview</span>}
      </div>
      {canUpload ? <form action={uploadAdmissionPhoto} className="admissions-photo-upload">
        <input type="hidden" name="admissionId" value={admissionId} />
        <label>
          Applicant photo
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              setValidationError(null);
              setPreviewUrl(null);
              if (!file) return;
              if (!allowedPhotoTypes.includes(file.type)) {
                setValidationError("Choose a JPG, PNG or WebP image.");
                event.currentTarget.value = "";
                return;
              }
              if (file.size > maxPhotoSize) {
                setValidationError("Photo must be 5 MB or smaller.");
                event.currentTarget.value = "";
                return;
              }
              setPreviewUrl(URL.createObjectURL(file));
            }}
          />
        </label>
        {validationError && <span className="admissions-photo-upload__error" role="alert">{validationError}</span>}
        <button type="submit" className="admissions-primary-action admissions-photo-save">{currentPhotoUrl ? "Save replacement photo" : "Save applicant photo"}</button>
        <small>JPG, PNG or WebP · maximum 5 MB</small>
      </form> : <p className="admissions-muted">Applicant photo</p>}
    </div>
  );
}
