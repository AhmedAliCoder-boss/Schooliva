import Link from "next/link";
import { redirect } from "next/navigation";

import { AdmissionPhotoPicker } from "@/components/admissions/admission-photo-picker";
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
    supabase.from("admissions").select("id,school_id,application_number,applicant_name,student_photo_url,date_of_birth,gender,email,phone,guardian_name,guardian_phone,guardian_relationship,address,applied_class_id,academic_session_id,application_source,status,documents_status,test_status,interview_status,application_date,notes,student_id,created_at").eq("id", id).eq("school_id", schoolId).maybeSingle(),
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
    "invalid-transition", "application-not-found", "student-conversion-failed", "conversion-cleanup-failed", "student-section-required", "student-section-invalid", "student-enrollment-failed", "status-update-failed",
    "invalid-class", "invalid-session", "application-update-failed", "document-too-large", "invalid-document-type",
    "document-upload-failed", "document-record-cleanup-failed", "document-record-failed", "invalid-stage",
    "stage-update-failed", "document-review-failed", "document-not-updated", "document-review-saved-refresh-failed", "document-review-stage-failed",
    "invalid-photo", "photo-too-large", "invalid-photo-type", "photo-record-failed", "photo-upload-failed", "photo-cleanup-failed", "old-photo-cleanup-failed",
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
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "admissions", target_action: "approve" }),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "admissions", target_action: "reject" }),
  ]);
  if (permissionResults.some((result) => result.error)) {
    return <main className="admissions-page"><section className="admissions-alert admissions-alert--error" role="alert">Admissions permissions could not be checked. Please refresh or contact an administrator.</section></main>;
  }
  const [canUpdate, canCreate, canReview, canManageDocuments, canManageTests, canManageInterviews, canDelete, canApprove, canReject] = permissionResults.map(({ data }) => Boolean(data));
  const canEditApplication = canUpdate || canReview;
  const canUploadDocuments = canManageDocuments || canUpdate || canCreate;

  const classOptions = classes ?? [];
  const sessionOptions = sessions ?? [];
  const { data: sections, error: sectionsError } = admission.applied_class_id
    ? await supabase.from("sections").select("id,name").eq("school_id", schoolId).eq("class_id", admission.applied_class_id).eq("status", "active").order("name")
    : { data: [], error: null };
  if (sectionsError) {
    return <main className="admissions-page"><section className="admissions-alert admissions-alert--error" role="alert">Class sections could not be loaded. Please refresh or contact an administrator.</section></main>;
  }
  const sectionOptions = sections ?? [];
  const { data: studentIdentity, error: studentIdentityError } = admission.student_id
    ? await supabase.from("students").select("id,student_identifier,admission_number").eq("id", admission.student_id).eq("school_id", schoolId).maybeSingle()
    : { data: null, error: null };
  if (studentIdentityError) {
    return <main className="admissions-page"><section className="admissions-alert admissions-alert--error" role="alert">Linked student identity could not be loaded. Please refresh or contact an administrator.</section></main>;
  }
  const documentRows = await Promise.all((documents ?? []).map(async (document) => {
    const { data, error: signedUrlError } = await supabase.storage.from("admission-documents").createSignedUrl(document.storage_path, 3600);
    return { ...document, url: signedUrlError ? null : data?.signedUrl ?? null };
  }));
  let photoUrl: string | null = null;
  let photoLoadError = false;
  if (admission.student_photo_url) {
    const { data, error: photoError } = await supabase.storage.from("admission-documents").createSignedUrl(admission.student_photo_url, 3600);
    if (photoError) {
      console.error("Could not prepare the admission photo preview.", photoError);
      photoLoadError = true;
    } else {
      photoUrl = data.signedUrl;
    }
  }
  const errorMessages: Record<string, string> = {
    "invalid-transition": "That status change is not allowed from the current stage.",
    "application-not-found": "The application could not be found in this school.",
    "student-conversion-failed": "The student record could not be created; the application is still unchanged.",
    "conversion-cleanup-failed": "Conversion did not finish and the temporary student record could not be cleaned up. Contact support.",
    "student-section-required": "Choose a class section before creating the enrolled student record.",
    "student-class-required": "Select and save the student's class and academic session before creating the student ID.",
    "student-section-invalid": "The selected section is no longer active for this class. Refresh and choose another section.",
    "student-enrollment-failed": "The student enrollment could not be created, so no incomplete student record was kept. Verify the class, session and section, then try again.",
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
    "document-not-updated": "No matching application document was updated. Refresh and try again, or contact an administrator.",
    "document-review-saved-refresh-failed": "Document status was saved, but its overall stage could not be refreshed.",
    "document-review-stage-failed": "Document status was saved, but the overall stage could not be updated.",
    "invalid-photo": "Choose an applicant photo to upload.",
    "photo-too-large": "Applicant photos must be 5 MB or smaller.",
    "invalid-photo-type": "Applicant photos must be JPG, PNG or WebP.",
    "photo-record-failed": "The applicant photo could not be saved to this application.",
    "photo-upload-failed": "Applicant photo upload failed. Check storage setup and try again.",
    "photo-cleanup-failed": "The new photo could not be saved and its upload could not be removed. Contact support.",
    "old-photo-cleanup-failed": "The new photo was saved, but the previous photo could not be removed. Contact support.",
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
    "photo-uploaded": "Applicant photo saved.",
    "student-created": "Admission complete. The student record and enrollment have been created.",
    "document-reviewed-not_started": "Document status saved as Not started.",
    "document-reviewed-pending": "Document marked as awaiting verification.",
    "document-reviewed-verified": "Document verified successfully.",
    "document-reviewed-rejected": "Document marked as needing replacement.",
  };
  const nextStatuses = transitions[String(admission.status)] ?? [];
  const canApproveApplication = canApprove || canReview;
  const directAdmissionStatus = nextStatuses.includes("approved") && canApproveApplication
    ? "approved"
    : nextStatuses.includes("admitted") && canApprove
      ? "admitted"
      : null;
  const directAdmissionLabel = directAdmissionStatus === "admitted" ? "Confirm admission" : "Approve application";
  const visibleNextStatuses = nextStatuses.filter((status) => {
    if (status === "approved") return canApproveApplication;
    if (status === "admitted" || status === "converted_to_student") return canApprove;
    if (status === "rejected") return canReject;
    if (status === "submitted" && admission.status === "draft") return canCreate || canReview;
    return canReview;
  }).filter((status) => status !== "converted_to_student");
  const canMoveStatus = visibleNextStatuses.length > 0;
  const canAddStudent = admission.status === "admitted" && canApprove && !admission.student_id;
  const needsEnrollment = Boolean(admission.applied_class_id && admission.academic_session_id);
  const normalizedDocuments = (documents ?? []).map((document) => ({
    ...document,
    normalizedType: document.document_type.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
  }));
  const requiredDocumentChecklist = [
    { label: "Birth certificate or B-form", required: true, matches: ["birth certificate", "b form", "b-form", "child registration", "crc"] },
    { label: "Parent / guardian CNIC", required: true, matches: ["guardian cnic", "parent cnic", "cnic"] },
    { label: "Previous school report", required: false, matches: ["previous school report", "previous report", "report card", "school report"] },
    { label: "Transfer certificate", required: false, matches: ["transfer certificate", "school leaving certificate"] },
    { label: "Proof of address", required: false, matches: ["proof of address", "address proof", "utility bill"] },
  ].map((item) => {
    const matched = normalizedDocuments.filter((document) => item.matches.some((match) => document.normalizedType.includes(match)));
    const state = matched.some((document) => document.status === "verified")
      ? "Verified"
      : matched.some((document) => document.status === "rejected")
        ? "Needs replacement"
        : matched.length
          ? "Uploaded · awaiting review"
          : "Not uploaded";
    return { ...item, state };
  });
  const stageData = [
    { key: "documents", label: "Documents", status: String(admission.documents_status), permission: canManageDocuments },
    { key: "test", label: "Assessment", status: String(admission.test_status), permission: canManageTests },
    { key: "interview", label: "Interview", status: String(admission.interview_status), permission: canManageInterviews },
  ];
  const studentRecordStatus = admission.student_id
    ? "Created"
    : admission.status === "admitted"
      ? "Ready to create"
      : "Locked until admitted";
  const liveStatuses = [
    { label: "Application", value: titleCase(String(admission.status)), tone: String(admission.status) },
    { label: "Documents", value: titleCase(String(admission.documents_status)), tone: String(admission.documents_status) },
    { label: "Assessment", value: titleCase(String(admission.test_status)), tone: String(admission.test_status) },
    { label: "Interview", value: titleCase(String(admission.interview_status)), tone: String(admission.interview_status) },
    { label: "Student record", value: studentRecordStatus, tone: admission.student_id ? "complete" : admission.status === "admitted" ? "ready" : "locked" },
  ];

  return (
    <main className="admissions-page">
      {query.error && errorMessages[query.error] && <p className="admissions-alert admissions-alert--error" role="alert">{errorMessages[query.error]}</p>}
      {query.success && successMessages[query.success] && <p className="admissions-alert admissions-alert--success" role="status">{successMessages[query.success]}</p>}
      <section className="admissions-page-heading">
        <div><p className="admissions-eyebrow">{admission.application_number}</p><h1>{admission.applicant_name}</h1><p>Application received {new Date(admission.application_date).toLocaleDateString()}</p></div>
        <div className="admissions-heading-actions">
          {directAdmissionStatus && <form action={updateAdmissionStatus} className="admissions-heading-action-form">
            <input type="hidden" name="admissionId" value={id} />
            <input type="hidden" name="status" value={directAdmissionStatus} />
            <button type="submit" className="admissions-primary-action">{directAdmissionLabel}</button>
          </form>}
          <Link href="/admissions/applications" className="admissions-secondary-action">← All applications</Link>
        </div>
      </section>

      <section className="admissions-live-status" aria-labelledby="admissions-live-status-title">
        <div className="admissions-live-status__heading">
          <div><p className="admissions-eyebrow">Live record</p><h2 id="admissions-live-status-title">Current application status</h2></div>
          <p>Values are read from this application and its linked student record.</p>
        </div>
        <dl>
          {liveStatuses.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd className={`admissions-live-status__value admissions-live-status__value--${item.tone}`}>{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="admissions-next-steps" aria-label="What to do next">
        <strong>Admission steps</strong>
        <ol>
          <li><span>1</span><div><b>Save details</b><small>Save applicant and guardian information.</small></div></li>
          <li><span>2</span><div><b>Upload documents</b><small>Choose a document type and file, then select Save / Upload.</small></div></li>
          <li><span>3</span><div><b>Review and approve</b><small>Mark documents verified, then approve the application.</small></div></li>
          <li><span>4</span><div><b>Admit and print</b><small>Confirm admission to unlock the printable admission form.</small></div></li>
          <li><span>5</span><div><b>Create student record</b><small>Generate the permanent four-digit student number and school/class/section ID, then create the ID card.</small></div></li>
        </ol>
      </section>

      <section className="admissions-detail-grid">
        <article className="admissions-card">
          <div className="admissions-card-heading"><div><p className="admissions-eyebrow">Applicant record</p><h2>Application details</h2></div>{canEditApplication && <span className="admissions-edit-hint">Edit fields and save below</span>}</div>
          <AdmissionPhotoPicker admissionId={id} applicantName={admission.applicant_name} currentPhotoUrl={photoUrl} canUpload={canUploadDocuments} photoUnavailable={photoLoadError} />
          {photoLoadError && <p className="admissions-alert admissions-alert--error" role="alert">The saved applicant photo could not be loaded. Contact an administrator if this continues.</p>}
          {canEditApplication ? (
            <form action={updateAdmission} id="admissions-edit-form" className="admissions-edit-form admissions-edit-form--inline">
              <input type="hidden" name="admissionId" value={id} />
              <label>Applicant full name<input name="applicantName" defaultValue={admission.applicant_name} required minLength={2} maxLength={160} /></label>
              <label>Date of birth<input type="date" name="dateOfBirth" defaultValue={admission.date_of_birth ?? ""} /></label>
              <label>Gender<select name="gender" defaultValue={admission.gender}><option value="prefer_not_to_say">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="non_binary">Non-binary</option></select></label>
              <label>Phone<input type="tel" name="phone" defaultValue={admission.phone ?? ""} /></label>
              <label>Email<input type="email" name="email" defaultValue={admission.email ?? ""} /></label>
              <label>Parent / guardian<input name="guardianName" defaultValue={admission.guardian_name ?? ""} /></label>
              <label>Guardian phone<input type="tel" name="guardianPhone" defaultValue={admission.guardian_phone ?? ""} /></label>
              <label>Relationship to student<select name="guardianRelationship" defaultValue={admission.guardian_relationship ?? "guardian"}><option value="father">Father</option><option value="mother">Mother</option><option value="guardian">Guardian</option><option value="other">Other</option></select></label>
              <label>Class<select name="classId" defaultValue={admission.applied_class_id ?? ""}><option value="">Not selected</option>{classOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label>Academic session<select name="sessionId" defaultValue={admission.academic_session_id ?? ""}><option value="">Not selected</option>{sessionOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label>Source<select name="source" defaultValue={admission.application_source}><option value="walk_in">Walk-in</option><option value="website">Website</option><option value="referral">Referral</option><option value="social_media">Social media</option><option value="other">Other</option></select></label>
              <label className="admissions-edit-form__wide">Address<textarea name="address" defaultValue={admission.address ?? ""} rows={3} /></label>
              <label className="admissions-edit-form__wide">Additional notes<textarea name="notes" defaultValue={admission.notes ?? ""} rows={3} /></label>
              {admission.student_id && <p className="admissions-linked-student">Student record linked: <strong>{admission.student_id}</strong></p>}
              <div className="admissions-edit-actions">
                <span>Changes are saved to this application record.</span>
                <button type="submit" className="admissions-primary-action">Save application</button>
              </div>
            </form>
          ) : (
            <dl className="admissions-detail-list">
              <DetailItem label="Date of birth" value={admission.date_of_birth ? new Date(`${admission.date_of_birth}T00:00:00`).toLocaleDateString() : "Not provided"} />
              <DetailItem label="Gender" value={titleCase(admission.gender)} />
              <DetailItem label="Phone" value={admission.phone ?? "Not provided"} />
              <DetailItem label="Email" value={admission.email ?? "Not provided"} />
              <DetailItem label="Parent / guardian" value={admission.guardian_name ?? "Not provided"} />
              <DetailItem label="Guardian phone" value={admission.guardian_phone ?? "Not provided"} />
              <DetailItem label="Relationship to student" value={titleCase(admission.guardian_relationship ?? "guardian")} />
              <DetailItem label="Address" value={admission.address ?? "Not provided"} />
              <DetailItem label="Class" value={classOptions.find((item) => item.id === admission.applied_class_id)?.name ?? "Not selected"} />
              <DetailItem label="Academic session" value={sessionOptions.find((item) => item.id === admission.academic_session_id)?.name ?? "Not selected"} />
              <DetailItem label="Source" value={titleCase(admission.application_source)} />
              <DetailItem label="Additional notes" value={admission.notes ?? "None"} />
              {admission.student_id && <DetailItem label="Student record" value={admission.student_id} />}
            </dl>
          )}
        </article>

        <article className="admissions-card">
          <div className="admissions-card-heading"><div><p className="admissions-eyebrow">Workflow</p><h2>Next decision</h2></div></div>
          {canMoveStatus ? (
            <form action={updateAdmissionStatus} className="admissions-inline-form">
              <input type="hidden" name="admissionId" value={id} />
              <label>Move application to<select name="status" defaultValue={visibleNextStatuses[0]}>{visibleNextStatuses.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></label>
              <button type="submit" className="admissions-primary-action">Update status</button>
            </form>
          ) : <p className="admissions-muted">{nextStatuses.length ? "You do not have permission to make the next decision." : "This application has reached the end of its status workflow."}</p>}
          {(admission.status === "admitted" || admission.status === "converted_to_student") && (
            <div className="admissions-print-action">
              <div><strong>Admission confirmed</strong><span>Print or save the completed school admission form.</span></div>
              <Link href={`/admissions/${id}/print`} className="admissions-primary-action">Print admission form</Link>
            </div>
          )}
          {canAddStudent && (
            <form action={updateAdmissionStatus} className="admissions-add-student">
              <input type="hidden" name="admissionId" value={id} />
              <input type="hidden" name="status" value="converted_to_student" />
              <div className="admissions-add-student__heading"><strong>Next: create the student record</strong><span>Admission is confirmed. Generate the admission form above, then create the permanent profile and short school/class/section ID.</span></div>
              {needsEnrollment && (
                <label className="admissions-section-picker">Initial class section
                  <select name="sectionId" required defaultValue="">
                    <option value="">Choose a section</option>
                    {sectionOptions.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                  </select>
                </label>
              )}
              {!needsEnrollment && <p className="admissions-alert admissions-alert--error">Save a class and academic session in Application details before creating the permanent student ID.</p>}
              {needsEnrollment && sectionOptions.length === 0 && <p className="admissions-alert admissions-alert--error">No active section exists for the selected class. Add or activate a section before creating the student.</p>}
              <button type="submit" className="admissions-primary-action" disabled={!needsEnrollment || sectionOptions.length === 0}>Create student &amp; ID</button>
            </form>
          )}
          {admission.student_id && <div className="admissions-add-student admissions-add-student--complete"><div><strong>Student record created</strong><span>Student ID: {studentIdentity?.student_identifier ?? "Unavailable"} · Admission no.: {studentIdentity?.admission_number ?? "Unavailable"}</span><small>Internal UUID: {admission.student_id}</small></div><div className="admissions-student-links"><Link href={`/students/${admission.student_id}`} className="admissions-secondary-action">Open student profile</Link><Link href={`/students/${admission.student_id}/id-card`} className="admissions-primary-action">Generate ID card</Link></div></div>}
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

      <section className="admissions-card">
        <div className="admissions-card-heading"><div><p className="admissions-eyebrow">Secure file storage</p><h2>Application documents</h2></div></div>
        <section className="admissions-required-documents" aria-labelledby="admissions-required-documents-title">
          <div className="admissions-required-documents__heading"><div><p className="admissions-eyebrow">Verification checklist</p><h3 id="admissions-required-documents-title">Required documents</h3></div><span>Upload files below and match each type to the checklist.</span></div>
          <ul>{requiredDocumentChecklist.map((item) => (
            <li key={item.label} className={`admissions-required-document admissions-required-document--${item.state === "Verified" ? "verified" : item.state === "Not uploaded" ? "missing" : "pending"}`}>
              <span className="admissions-required-document__icon">{item.state === "Verified" ? "✓" : item.state === "Not uploaded" ? "!" : "•"}</span>
              <span><strong>{item.label}</strong><small>{item.required ? "Required" : "If applicable"}</small></span>
              <em>{item.state}</em>
            </li>
          ))}</ul>
          <p>Birth certificate or B-form and parent / guardian CNIC are required. Previous school records and transfer certificates apply when transferring from another school.</p>
        </section>
        {canUploadDocuments ? (
          <form action={addAdmissionDocument} className="admissions-document-upload admissions-document-upload--prominent">
            <input type="hidden" name="admissionId" value={id} />
            <div className="admissions-document-upload__heading"><strong>Upload a verification document</strong><span>Attach a clear scan or photo. Files remain private to this school.</span></div>
            <label>Document type<input name="documentType" list="admission-document-types" required minLength={2} maxLength={80} placeholder="Choose or enter document type" />
              <datalist id="admission-document-types">
                <option value="Birth certificate" /><option value="B-form / child registration certificate" /><option value="Guardian CNIC" />
                <option value="Previous school report" /><option value="Transfer certificate" /><option value="Proof of address" /><option value="Other" />
              </datalist>
            </label>
            <label>Choose file<input type="file" name="document" accept=".pdf,image/jpeg,image/png,image/webp" required /></label>
            <button type="submit" className="admissions-primary-action admissions-document-save"><span aria-hidden="true">↑</span> Save / Upload document</button>
            <small>PDF, JPG, PNG or WebP · maximum 10 MB</small>
          </form>
        ) : (
          <p className="admissions-upload-permission-note">You need admissions create, update, or document-management access to upload files.</p>
        )}
        {documentsError ? <p className="admissions-alert admissions-alert--error" role="alert">{documentsError.message}</p> : (
          <>
            {documentRows.length ? <div className="admissions-document-list">{documentRows.map((document) => (
              <div className="admissions-document-row" key={document.id}>
                <div><strong>{document.document_type}</strong><span>{document.file_name} · {new Date(document.uploaded_at).toLocaleDateString()}</span></div>
                <span className="admissions-status">{titleCase(document.status)}</span>
                {document.url ? <a href={document.url} target="_blank" rel="noreferrer">Open</a> : <span className="admissions-muted">File link unavailable</span>}
                {canManageDocuments && <form action={updateAdmissionDocument} className="admissions-document-review-form"><input type="hidden" name="admissionId" value={id} /><input type="hidden" name="documentId" value={document.id} /><label className="admissions-document-review-form__field"><span>Review status</span><select name="status" defaultValue={document.status}>{stageStatuses.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></label><button type="submit" className="admissions-document-review-save">Save status</button></form>}
              </div>
              ))}</div> : <p className="admissions-muted">No documents uploaded yet.</p>}
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
