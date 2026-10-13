import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintAction } from "@/components/print/print-action";
import { SchoolDocument } from "@/components/print/school-document";
import { requireAdmissionContext } from "@/lib/admissions/context";
import { getSchoolDocumentIdentity } from "@/lib/print/school-document";

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function valueOrDash(value: string | null | undefined) {
  return value?.trim() || "—";
}

export default async function AdmissionPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, schoolId } = await requireAdmissionContext("view");
  const [{ data: admission, error }, { data: documents, error: documentsError }, school] = await Promise.all([
    supabase.from("admissions")
      .select("id,school_id,application_number,applicant_name,student_photo_url,date_of_birth,gender,email,phone,guardian_name,guardian_phone,guardian_relationship,address,applied_class_id,academic_session_id,status,application_date,notes,student_id")
      .eq("id", id)
      .eq("school_id", schoolId)
      .maybeSingle(),
    supabase.from("admission_documents")
      .select("id,document_type,status,uploaded_at")
      .eq("admission_id", id)
      .order("uploaded_at", { ascending: true }),
    getSchoolDocumentIdentity(supabase, schoolId),
  ]);
  if (error) throw new Error("Admission application could not be loaded for printing.");
  if (documentsError) throw new Error("Admission document checklist could not be loaded for printing.");
  if (!admission) notFound();
  if (admission.status !== "admitted" && admission.status !== "converted_to_student") {
    return (
      <main className="school-document-page">
        <section className="school-document">
          <h1>Admission form not available yet</h1>
          <p>The printable admission form is available after the applicant has been admitted.</p>
          <Link href={`/admissions/${id}`}>Back to application</Link>
        </section>
      </main>
    );
  }

  const [{ data: schoolClass, error: classError }, { data: session, error: sessionError }] = await Promise.all([
    admission.applied_class_id
      ? supabase.from("classes").select("name").eq("id", admission.applied_class_id).eq("school_id", schoolId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admission.academic_session_id
      ? supabase.from("academic_sessions").select("name").eq("id", admission.academic_session_id).eq("school_id", schoolId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (classError || sessionError) throw new Error("Admission class or academic session could not be loaded for printing.");

  const { data: student, error: studentError } = admission.student_id
    ? await supabase.from("students")
      .select("id,admission_number,student_identifier,student_enrollments(status,sections(name))")
      .eq("id", admission.student_id)
      .eq("school_id", schoolId)
      .maybeSingle()
    : { data: null, error: null };
  if (studentError) throw new Error("Student identity could not be loaded for printing.");
  if (admission.student_id && !student) throw new Error("The linked student identity is missing.");

  let photoUrl: string | null = null;
  if (admission.student_photo_url) {
    const { data, error: photoError } = await supabase.storage.from("admission-documents").createSignedUrl(admission.student_photo_url, 3600);
    if (photoError) throw new Error("Applicant photo could not be prepared for printing.");
    photoUrl = data.signedUrl;
  }

  return (
    <main className="school-document-page">
      <div className="school-document-toolbar no-print">
        <Link href={`/admissions/${id}`}>Back to application</Link>
        <PrintAction label="Print admission form / Save PDF" />
      </div>
      <SchoolDocument className="school-document--admission" school={school} title="Admission form" reference={String(admission.application_number)}>
        <h3 className="school-document__section-title">Student information</h3>
        <div className="admission-print-intro">
          <dl className="school-document__facts">
            <div><dt>Full name</dt><dd>{admission.applicant_name}</dd></div>
            <div><dt>Date of birth</dt><dd>{admission.date_of_birth ? new Date(`${admission.date_of_birth}T00:00:00`).toLocaleDateString() : "—"}</dd></div>
            <div><dt>Gender</dt><dd>{titleCase(admission.gender)}</dd></div>
            <div><dt>Class</dt><dd>{valueOrDash(schoolClass?.name)}</dd></div>
            <div><dt>Academic session</dt><dd>{valueOrDash(session?.name)}</dd></div>
            <div><dt>Application received</dt><dd>{new Date(`${admission.application_date}T00:00:00`).toLocaleDateString()}</dd></div>
            <div><dt>Decision</dt><dd>{titleCase(admission.status === "converted_to_student" ? "admitted" : admission.status)}</dd></div>
            {student && <div><dt>Admission number</dt><dd>{student.admission_number}</dd></div>}
            {student && <div><dt>Student ID</dt><dd>{student.student_identifier}</dd></div>}
            {student && <div><dt>Section</dt><dd>{valueOrDash(student.student_enrollments.find((enrollment) => enrollment.status === "active")?.sections?.[0]?.name)}</dd></div>}
          </dl>
          {photoUrl && <Image src={photoUrl} alt={`${admission.applicant_name} applicant photo`} width={112} height={132} unoptimized />}
        </div>

        <h3 className="school-document__section-title">Parent / guardian contact</h3>
        <dl className="school-document__facts">
          <div><dt>Parent / guardian</dt><dd>{valueOrDash(admission.guardian_name)}</dd></div>
          <div><dt>Guardian phone</dt><dd>{valueOrDash(admission.guardian_phone)}</dd></div>
          <div><dt>Relationship to student</dt><dd>{titleCase(admission.guardian_relationship ?? "guardian")}</dd></div>
          <div><dt>Student phone</dt><dd>{valueOrDash(admission.phone)}</dd></div>
          <div><dt>Email</dt><dd>{valueOrDash(admission.email)}</dd></div>
          <div className="admission-print-wide"><dt>Home address</dt><dd>{valueOrDash(admission.address)}</dd></div>
        </dl>

        <h3 className="school-document__section-title">Document verification</h3>
        {documents?.length ? (
          <table className="school-document__table">
            <thead><tr><th>Document type</th><th>Verification</th><th>Received</th></tr></thead>
            <tbody>{documents.map((document) => (
              <tr key={document.id}>
                <td>{document.document_type}</td><td>{titleCase(document.status)}</td>
                <td>{new Date(document.uploaded_at).toLocaleDateString()}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p className="admission-print-empty">No verification documents have been recorded.</p>}

        {admission.notes?.trim() && <>
          <h3 className="school-document__section-title">Additional notes</h3>
          <p className="admission-print-notes">{admission.notes}</p>
        </>}

        <div className="admission-print-declaration">
          <strong>Declaration</strong>
          <p>I confirm that the information provided above is accurate and agree to the school’s admission terms.</p>
        </div>
        <div className="school-document__signatures admission-print-signatures">
          <span>Parent / guardian signature</span><span>Admissions officer</span><span>Principal / authorized signature</span>
        </div>
      </SchoolDocument>
    </main>
  );
}
