import Link from "next/link";
import { redirect } from "next/navigation";

import { addAdmissionDocument, deleteAdmission, updateAdmission, updateAdmissionDocument, updateAdmissionStage, updateAdmissionStatus } from "@/app/actions/admissions";
import { requireAdmissionContext } from "@/lib/admissions/context";

const transitions: Record<string, string[]> = {
  draft: ["submitted"],
  submitted: ["under_review", "documents_pending", "rejected"],
  under_review: ["documents_pending", "test_pending", "interview_pending", "approved", "rejected", "waitlisted"],
  documents_pending: ["under_review", "test_pending", "interview_pending", "approved", "rejected", "waitlisted"],
  test_pending: ["under_review", "interview_pending", "approved", "rejected", "waitlisted"],
  interview_pending: ["under_review", "approved", "rejected", "waitlisted"],
  approved: ["admitted", "rejected"],
  waitlisted: ["admitted", "rejected"],
  admitted: ["converted_to_student"],
};

const stageStatuses = ["not_started", "pending", "verified", "rejected"];

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function AdmissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { schoolId, supabase } = await requireAdmissionContext("view");
  const { id } = await params;
  const query = await searchParams;
  const [{ data: admission, error }, { data: classes, error: classesError }, { data: sessions, error: sessionsError }, { data: documents, error: documentsError }] = await Promise.all([
    supabase.from("admissions").select("id,school_id,application_number,applicant_name,date_of_birth,gender,email,phone,guardian_name,guardian_phone,address,applied_class_id,academic_session_id,application_source,status,documents_status,test_status,interview_status,application_date,notes,student_id,created_at").eq("id", id).eq("school_id", schoolId).maybeSingle(),
    supabase.from("classes").select("id,name").eq("school_id", schoolId).order("grade_level", { ascending: true }),
    supabase.from("academic_sessions").select("id,name,is_current").eq("school_id", schoolId).order("starts_on", { ascending: false }),
    supabase.from("admission_documents").select("id,document_type,file_name,storage_path,status,uploaded_at").eq("admission_id", id).order("uploaded_at", { ascending: false }),
  ]);

  if (error) return <main className="admissions-page"><section className="admissions-empty" role="alert"><h2>Application could not be loaded</h2><p>{error.message}</p></section></main>;
  if (!admission) return <main className="admissions-page"><section className="admissions-empty"><h2>Application not found</h2><Link href="/admissions/applications">Back to applications →</Link></section></main>;
  if (classesError || sessionsError) {
    return <main className="admissions-page"><section className="admissions-alert admissions-alert--error" role="alert">{classesError?.message ?? sessionsError?.message}</section></main>;
  }
  if (query.error && ![
    "invalid-transition", "application-not-found", "student-conversion-failed", "conversion-cleanup-failed", "status-update-failed",
    "invalid-class", "invalid-session", "application-update-failed", "document-too-large", "invalid-document-type",
    "document-upload-failed", "document-record-cleanup-failed", "document-record-failed", "invalid-stage",
    "stage-update-failed", "document-review-failed", "document-review-saved-refresh-failed", "document-review-stage-failed",
    "converted-application-cannot-delete", "documents-load-failed", "documents-delete-failed", "application-delete-failed",
  ].includes(query.error)) redirect(`/admissions/${id}`);

  const permissionResults = await Promise.all([
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "admissions", target_action: "update" }),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "admissions", target_action: "create" }),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "admissions", target_action: "review" }),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "admissions", target_action: "manage_documents" }),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "admissions", target_action: "manage_tests" }),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "admissions", target_action: "manage_interviews" }),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "admissions", target_action: "delete" }),
  ]);
  if (permissionResults.some((result) => result.error)) {
    return <main className="admissions-page"><section className="admissions-alert admissions-alert--error" role="alert">Admissions permissions could not be checked. Please refresh or contact an administrator.</section></main>;
  }
  const [canUpdate, canCreate, canReview, canManageDocuments, canManageTests, canManageInterviews, canDelete] = permissionResults.map(({ data }) => Boolean(data));

  const classOptions = classes ?? [];
  const sessionOptions = sessions ?? [];
  const documentRows = await Promise.all((documents ?? []).map(async (document) => {
    const { data, error: signedUrlError } = await supabase.storage.from("admission-documents").createSignedUrl(document.storage_path, 3600);
    return { ...document, url: signedUrlError ? null : data?.signedUrl ?? null };
  }));
  const errorMessages: Record<string, string> = {
    "invalid-transition": "That status change is not allowed from the current stage.",
    "application-not-found": "The application could not be found in this school.",
    "student-conversion-failed": "The student record could not be created; the application is still unchanged.",
    "conversion-cleanup-failed": "Conversion did not finish and the temporary student record could not be cleaned up. Contact support.",
    "status-update-failed": "The application status could not be updated.",
    "invalid-class": "The selected class is not available for this school.",
    "invalid-session": "The selected academic session is not available for this school.",
    "application-update-failed": "Application details could not be saved.",
    "document-too-large": "Documents must be 10 MB or smaller.",
    "invalid-document-type": "Only PDF, JPG, PNG and WebP documents are accepted.",
    "document-upload-failed": "Document upload failed. Check storage setup and try again.",
    "document-record-cleanup-failed": "Document metadata save failed and the uploaded file could not be cleaned up. Contact support.",
    "document-record-failed": "Document details could not be saved.",
    "invalid-stage": "Choose a valid stage status.",
    "stage-update-failed": "The admissions stage could not be updated.",
    "document-review-failed": "Document review status could not be saved.",
    "document-review-saved-refresh-failed": "Document status was saved, but its overall stage could not be refreshed.",
    "document-review-stage-failed": "Document status was saved, but the overall stage could not be updated.",
    "converted-application-cannot-delete": "A converted application cannot be deleted.",
    "documents-load-failed": "Documents could not be loaded before deletion.",
    "documents-delete-failed": "Application documents could not be removed; the application was kept.",
    "application-delete-failed": "The application could not be deleted.",
  };
  const successMessages: Record<string, string> = {
    "application-created": "Application saved successfully.",
    "application-updated": "Application details updated.",
    "status-updated": "Application status updated.",
    "stage-updated": "Admissions stage updated.",
    "document-added": "Document uploaded successfully.",
    "document-reviewed": "Document review saved.",
  };
  const nextStatuses = transitions[String(admission.status)] ?? [];
  const canMoveStatus = canReview || (admission.status === "draft" && canCreate);
  const stageData = [
    { key: "documents", label: "Documents", status: String(admission.documents_status), permission: canManageDocuments },
    { key: "test", label: "Assessment", status: String(admission.test_status), permission: canManageTests },
    { key: "interview", label: "Interview", status: String(admission.interview_status), permission: canManageInterviews },
  ];

  return (
    <main className="admissions-page">
      {query.error && errorMessages[query.error] && <p className="admissions-alert admissions-alert--error" role="alert">{errorMessages[query.error]}</p>}
      {query.success && successMessages[query.success] && <p className="admissions-alert admissions-alert--success" role="status">{successMessages[query.success]}</p>}
      <section className="admissions-page-heading">
        <div><p className="admissions-eyebrow">{admission.application_number}</p><h1>{admission.applicant_name}</h1><p>Application received {new Date(admission.application_date).toLocaleDateString()}</p></div>
        <Link href="/admissions/applications" className="admissions-secondary-action">← All applications</Link>
      </section>

      <section className="admissions-detail-grid">
        <article className="admissions-card">
          <div className="admissions-card-heading"><div><p className="admissions-eyebrow">Applicant record</p><h2>Application details</h2></div><span className={`admissions-status admissions-status--${admission.status}`}>{titleCase(admission.status)}</span></div>
          <dl className="admissions-detail-list">
            <DetailItem label="Date of birth" value={admission.date_of_birth ? new Date(`${admission.date_of_birth}T00:00:00`).toLocaleDateString() : "Not provided"} />
            <DetailItem label="Gender" value={titleCase(admission.gender)} />
            <DetailItem label="Phone" value={admission.phone ?? "Not provided"} />
            <DetailItem label="Email" value={admission.email ?? "Not provided"} />
            <DetailItem label="Parent / guardian" value={admission.guardian_name ?? "Not provided"} />
            <DetailItem label="Guardian phone" value={admission.guardian_phone ?? "Not provided"} />
            <DetailItem label="Address" value={admission.address ?? "Not provided"} />
            <DetailItem label="Class" value={classOptions.find((item) => item.id === admission.applied_class_id)?.name ?? "Not selected"} />
            <DetailItem label="Academic session" value={sessionOptions.find((item) => item.id === admission.academic_session_id)?.name ?? "Not selected"} />
            <DetailItem label="Source" value={titleCase(admission.application_source)} />
            <DetailItem label="Additional notes" value={admission.notes ?? "None"} />
            {admission.student_id && <DetailItem label="Student record" value={admission.student_id} />}
          </dl>
        </article>

        <article className="admissions-card">
          <div className="admissions-card-heading"><div><p className="admissions-eyebrow">Workflow</p><h2>Next decision</h2></div></div>
          {canMoveStatus && nextStatuses.length ? (
            <form action={updateAdmissionStatus} className="admissions-inline-form">
              <input type="hidden" name="admissionId" value={id} />
              <label>Move application to<select name="status" defaultValue={nextStatuses[0]}>{nextStatuses.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></label>
              <button type="submit" className="admissions-primary-action">Update status</button>
            </form>
          ) : <p className="admissions-muted">{nextStatuses.length ? "You do not have permission to review this application." : "This application has reached the end of its status workflow."}</p>}
          <div className="admissions-stage-list">
            {stageData.map((stage) => (
              <form action={updateAdmissionStage} className="admissions-stage-row" key={stage.key}>
                <input type="hidden" name="admissionId" value={id} /><input type="hidden" name="stage" value={stage.key} />
                <span><strong>{stage.label}</strong><small>{titleCase(stage.status)}</small></span>
                {stage.permission ? <><select name="stageStatus" defaultValue={stage.status}>{stageStatuses.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select><button type="submit" aria-label={`Save ${stage.label} status`}>Save</button></> : <span className="admissions-muted">View only</span>}
              </form>
            ))}
          </div>
        </article>
      </section>

      {canUpdate && (
        <details className="admissions-card admissions-edit">
          <summary>Edit applicant details</summary>
          <form action={updateAdmission} className="admissions-edit-form">
            <input type="hidden" name="admissionId" value={id} />
            <label>Applicant full name<input name="applicantName" defaultValue={admission.applicant_name} required minLength={2} maxLength={160} /></label>
            <label>Date of birth<input type="date" name="dateOfBirth" defaultValue={admission.date_of_birth ?? ""} /></label>
            <label>Gender<select name="gender" defaultValue={admission.gender}><option value="prefer_not_to_say">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="non_binary">Non-binary</option></select></label>
            <label>Phone<input type="tel" name="phone" defaultValue={admission.phone ?? ""} /></label>
            <label>Email<input type="email" name="email" defaultValue={admission.email ?? ""} /></label>
            <label>Parent / guardian<input name="guardianName" defaultValue={admission.guardian_name ?? ""} /></label>
            <label>Guardian phone<input type="tel" name="guardianPhone" defaultValue={admission.guardian_phone ?? ""} /></label>
            <label>Class<select name="classId" defaultValue={admission.applied_class_id ?? ""}><option value="">Not selected</option>{classOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Academic session<select name="sessionId" defaultValue={admission.academic_session_id ?? ""}><option value="">Not selected</option>{sessionOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Source<select name="source" defaultValue={admission.application_source}><option value="walk_in">Walk-in</option><option value="website">Website</option><option value="referral">Referral</option><option value="social_media">Social media</option><option value="other">Other</option></select></label>
            <label className="admissions-edit-form__wide">Address<textarea name="address" defaultValue={admission.address ?? ""} rows={3} /></label>
            <label className="admissions-edit-form__wide">Additional notes<textarea name="notes" defaultValue={admission.notes ?? ""} rows={3} /></label>
            <button type="submit" className="admissions-primary-action">Save changes</button>
          </form>
        </details>
      )}

      <section className="admissions-card">
        <div className="admissions-card-heading"><div><p className="admissions-eyebrow">Secure file storage</p><h2>Application documents</h2></div></div>
        {documentsError ? <p className="admissions-alert admissions-alert--error" role="alert">{documentsError.message}</p> : (
          <>
            {documentRows.length ? <div className="admissions-document-list">{documentRows.map((document) => (
              <div className="admissions-document-row" key={document.id}>
                <div><strong>{document.document_type}</strong><span>{document.file_name} · {new Date(document.uploaded_at).toLocaleDateString()}</span></div>
                <span className="admissions-status">{titleCase(document.status)}</span>
                {document.url ? <a href={document.url} target="_blank" rel="noreferrer">Open</a> : <span className="admissions-muted">File link unavailable</span>}
                {canManageDocuments && <form action={updateAdmissionDocument}><input type="hidden" name="admissionId" value={id} /><input type="hidden" name="documentId" value={document.id} /><select name="status" defaultValue={document.status}>{stageStatuses.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select><button type="submit">Save</button></form>}
              </div>
            ))}</div> : <p className="admissions-muted">No documents uploaded yet.</p>}
            {canManageDocuments && (
              <form action={addAdmissionDocument} className="admissions-document-upload">
                <input type="hidden" name="admissionId" value={id} />
                <label>Document type<input name="documentType" required minLength={2} maxLength={80} placeholder="Birth certificate" /></label>
                <label>Choose file<input type="file" name="document" accept=".pdf,image/jpeg,image/png,image/webp" required /></label>
                <button type="submit" className="admissions-primary-action">Upload document</button>
                <small>PDF, JPG, PNG or WebP · maximum 10 MB</small>
              </form>
            )}
          </>
        )}
      </section>

      {canDelete && !admission.student_id && (
        <details className="admissions-delete">
          <summary>Delete this application</summary>
          <form action={deleteAdmission}><input type="hidden" name="admissionId" value={id} /><label>Type DELETE to confirm<input name="confirmation" required pattern="DELETE" /></label><button type="submit">Permanently delete</button></form>
        </details>
      )}
    </main>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
