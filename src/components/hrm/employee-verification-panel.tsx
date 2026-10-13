import Image from "next/image";
import Link from "next/link";

import { EmployeeVerificationReviewForm, EmployeeVerificationUploadForm } from "@/components/hrm/employee-verification-upload-form";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type EmployeeType = "teacher" | "staff";
type EmployeeDocument = {
  id: string;
  document_type: string;
  storage_path: string;
  original_name: string;
  file_size: number;
  created_at: string;
  status: "pending" | "verified" | "rejected";
};
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function isEmployeeIdCardReady(
  supabase: ServerSupabaseClient,
  schoolId: string,
  employeeType: EmployeeType,
  employeeId: string,
  photoPath: string | null,
) {
  if (!photoPath) return false;

  const { data, error } = await supabase.from("hrm_employee_documents")
    .select("document_type,status")
    .eq("school_id", schoolId)
    .eq("employee_type", employeeType)
    .eq("employee_id", employeeId);
  if (error) throw new Error("Employee verification status could not be checked for ID card readiness.");

  const documents = data ?? [];
  const requiredTypes = ["national_id", "qualification"];
  const hasAllRequiredVerified = requiredTypes.every((type) =>
    documents.some((document) => document.document_type === type && document.status === "verified")
  );
  return hasAllRequiredVerified && documents.every((document) => document.status === "verified");
}

export async function getEmployeePhotoUrl(photoPath: string | null) {
  if (!photoPath) return null;
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) throw new Error("Employee photos cannot be loaded without server-side Supabase administration.");
  const { data, error } = await adminClient.storage.from("profile-avatars").createSignedUrl(photoPath, 600);
  if (error || !data?.signedUrl) {
    console.error("Could not create a private employee-photo link.", error);
    throw new Error("The employee photo could not be opened.");
  }
  return data.signedUrl;
}

export function EmployeePhotoPanel({
  name,
  photoUrl,
  employeeId,
  employeeType,
  canManage = false,
  embedded = false,
}: {
  name: string;
  photoUrl: string | null;
  employeeId: string;
  employeeType: EmployeeType;
  canManage?: boolean;
  embedded?: boolean;
}) {
  const initials = name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <section className={`hrm-employee-photo-panel${embedded ? " hrm-employee-photo-panel--embedded" : " student-panel"}`}>
    <div className="student-panel-heading"><h2>Employee photo</h2><span>Profile image</span></div>
    {photoUrl
      ? <Image src={photoUrl} alt={`${name} employee photo`} width={240} height={240} unoptimized className="hrm-employee-photo" />
      : <div className="hrm-employee-photo hrm-employee-photo--empty" aria-label="No employee photo uploaded">{initials || "—"}</div>}
    {canManage && <EmployeeVerificationUploadForm employeeId={employeeId} employeeType={employeeType} documentType="profile_photo" />}
  </section>;
}

export async function EmployeeVerificationPanel({
  supabase,
  schoolId,
  employeeType,
  employeeId,
  canManage = false,
}: {
  supabase: ServerSupabaseClient;
  schoolId: string;
  employeeType: EmployeeType;
  employeeId: string;
  canManage?: boolean;
}) {
  const { data, error } = await supabase.from("hrm_employee_documents")
    .select("id,document_type,storage_path,original_name,file_size,created_at,status")
    .eq("school_id", schoolId)
    .eq("employee_type", employeeType)
    .eq("employee_id", employeeId)
    .order("created_at");
  if (error) throw new Error("Employee verification documents could not be loaded.");

  const documents = (data ?? []) as EmployeeDocument[];
  const latestByType = new Map<string, EmployeeDocument>();
  for (const document of documents) latestByType.set(document.document_type, document);
  const adminClient = createSupabaseAdminClient();
  if (documents.length && !adminClient) {
    throw new Error("Employee document links cannot be generated without server-side Supabase administration.");
  }

  const labels: Record<string, string> = {
    national_id: "National ID / CNIC",
    qualification: "Qualification certificate",
    experience: "Experience document",
    police_verification: "Police verification",
  };
  const checklist = [
    { type: "national_id", label: "National ID / CNIC", required: true },
    { type: "qualification", label: "Qualification certificate", required: true },
    { type: "experience", label: "Experience document", required: false },
    { type: "police_verification", label: "Police verification", required: false },
  ];
  const links = await Promise.all(documents.map(async (document) => {
    if (!adminClient) throw new Error("Employee document links are not configured.");
    const { data: signed, error: signedError } = await adminClient.storage
      .from("employee-verification")
      .createSignedUrl(document.storage_path, 600);
    if (signedError || !signed?.signedUrl) {
      console.error("Could not create a private employee-document link.", signedError);
      throw new Error("An employee verification document could not be opened.");
    }
    return { ...document, label: labels[document.document_type] ?? document.document_type, url: signed.signedUrl };
  }));
  const urlByDocumentId = new Map(links.map((document) => [document.id, document.url]));
  const documentsToReview = links.filter((document) => document.status !== "verified");

  return <>
    <section className="student-panel hrm-verification-panel">
      <div className="student-panel-heading"><div><h2>Document verification</h2><span>Private employee documents</span></div><span>{documentsToReview.length} to review</span></div>
      <ul className="hrm-document-checklist">{checklist.map((item) => {
        const latest = latestByType.get(item.type);
        const state = latest?.status ?? "missing";
        const cardContent = <>
          <span className="hrm-document-checklist__icon" aria-hidden="true">{state === "verified" ? "✓" : state === "missing" || state === "rejected" ? "!" : "•"}</span>
          <span><strong>{item.label}</strong><small>{item.required ? "Required" : "If applicable"}</small></span>
          <em>{state === "missing" ? "Not uploaded" : state === "rejected" ? "Needs replacement" : state === "verified" ? "Verified · click to open" : "Pending review"}</em>
        </>;
        const verifiedDocument = latest && state === "verified" ? urlByDocumentId.get(latest.id) : null;
        return <li className={`hrm-document-checklist__item hrm-document-checklist__item--${state}${verifiedDocument ? " hrm-document-checklist__item--link" : ""}`} key={item.type}>
          {verifiedDocument
            ? <Link href={verifiedDocument} target="_blank" rel="noreferrer" aria-label={`Open verified ${item.label} document`}>{cardContent}</Link>
            : cardContent}
        </li>;
      })}</ul>
      {documentsToReview.length ? <ul className="enrollment-list">{documentsToReview.map((document) => <li key={document.id}>
        <div><strong>{document.label}</strong><span>{document.original_name} · {(document.file_size / 1024 / 1024).toFixed(2)} MB</span></div>
        <Link href={document.url} target="_blank" rel="noreferrer">Open</Link>
        {canManage && <EmployeeVerificationReviewForm
          employeeId={employeeId}
          employeeType={employeeType}
          documentId={document.id}
          status={document.status}
        />}
      </li>)}</ul> : <p className="student-muted">{documents.length ? "All uploaded documents are verified. Open any verified checklist card to view its file." : "No hiring documents are attached to this employee."}</p>}
    </section>
    {canManage && <section className="student-panel hrm-document-upload-panel">
      <div className="student-panel-heading"><h2>Add verification document</h2><span>One file at a time</span></div>
      <EmployeeVerificationUploadForm employeeId={employeeId} employeeType={employeeType} />
    </section>}
  </>;
}
