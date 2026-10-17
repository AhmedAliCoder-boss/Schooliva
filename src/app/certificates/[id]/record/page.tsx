import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireDocumentContext } from "@/lib/documents/context";
import { getSchoolDocumentIdentity } from "@/lib/print/school-document";

type Relation<T> = T | T[] | null;

type CertificateContent = Record<string, unknown>;

const hiddenContentKeys = new Set([
  "certificateTitle",
  "studentName",
  "studentIdentifier",
  "admissionNumber",
  "certificateKind",
]);

function relation<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function labelFor(key: string) {
  return key
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function valueFor(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(date);
}

export default async function CertificateRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, schoolId } = await requireDocumentContext("manage");
  const { data: allowed, error: permissionError } = await supabase.rpc("has_permission", {
    target_school_id: schoolId,
    target_resource: "certificates",
    target_action: "manage",
  });
  if (permissionError) {
    console.error("Certificate record permission could not be checked.", permissionError);
    throw new Error("Certificate record permissions could not be verified.");
  }
  if (!allowed) notFound();

  const { data: certificate, error } = await supabase.from("certificate_records")
    .select("id,student_id,certificate_type,certificate_number,issued_on,status,content")
    .eq("id", id)
    .eq("school_id", schoolId)
    .eq("status", "issued")
    .maybeSingle();
  if (error) {
    console.error("Certificate history record could not be loaded.", error);
    throw new Error("Certificate history record could not be loaded.");
  }
  if (!certificate) notFound();

  const [{ data: student, error: studentError }, { data: enrollment, error: enrollmentError }, school] = await Promise.all([
    supabase.from("students")
      .select("id,first_name,middle_name,last_name,student_identifier,admission_number,date_of_birth,gender,phone,photo_path")
      .eq("id", certificate.student_id)
      .eq("school_id", schoolId)
      .maybeSingle(),
    supabase.from("student_enrollments")
      .select("roll_number,classes(name),sections(name),academic_sessions(name)")
      .eq("student_id", certificate.student_id)
      .eq("school_id", schoolId)
      .eq("status", "active")
      .order("enrolled_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getSchoolDocumentIdentity(supabase, schoolId),
  ]);
  if (studentError || enrollmentError) {
    console.error("Student identity or enrollment could not be loaded for certificate history.", studentError ?? enrollmentError);
    throw new Error("Student details could not be loaded for this certificate record.");
  }

  let photoUrl: string | null = null;
  if (student?.photo_path) {
    const { data, error: photoError } = await supabase.storage.from("admission-documents").createSignedUrl(student.photo_path, 3600);
    if (photoError) {
      console.error("Student photo could not be prepared for certificate history.", photoError);
      throw new Error("Student photo could not be prepared for the certificate record.");
    }
    photoUrl = data.signedUrl;
  }

  const content = certificate.content && typeof certificate.content === "object"
    ? certificate.content as CertificateContent
    : {};
  const enrollmentClass = relation<{ name: string }>(enrollment?.classes ?? null);
  const enrollmentSection = relation<{ name: string }>(enrollment?.sections ?? null);
  const enrollmentSession = relation<{ name: string }>(enrollment?.academic_sessions ?? null);
  const studentName = [student?.first_name, student?.middle_name, student?.last_name].filter(Boolean).join(" ")
    || valueFor(content.studentName);
  const schoolLocation = [school.address, school.city, school.state, school.postal_code, school.country].filter(Boolean).join(", ");
  const detailEntries = Object.entries(content).filter(([key]) => !hiddenContentKeys.has(key));
  const certificateTitle = typeof content.certificateTitle === "string" && content.certificateTitle
    ? content.certificateTitle
    : `${certificate.certificate_type.replaceAll("_", " ").replace(/\b\w/g, (letter: string) => letter.toUpperCase())} Certificate`;

  return (
    <main className="certificate-record-page">
      <header className="certificate-record-toolbar">
        <Link href="/certificates">← Back to certificates</Link>
        <div>
          <Link className="student-primary-action" href={`/certificates/${certificate.id}`}>Open / print certificate</Link>
          {student && <Link className="student-secondary-action" href={`/students/${student.id}/id-card`}>View / print double-sided ID card</Link>}
        </div>
      </header>

      <section className="certificate-record-heading">
        <div>
          <span className="certificate-record-eyebrow">Issued certificate record</span>
          <h1>{certificateTitle}</h1>
          <p>Certificate no. <strong>{certificate.certificate_number}</strong></p>
        </div>
        <span className="certificate-record-status">Issued</span>
      </section>

      <div className="certificate-record-layout">
        <div className="certificate-record-main">
          <section className="student-panel certificate-record-panel">
            <header className="certificate-record-section-heading">
              <div><h2>Certificate details</h2><p>Saved issue details and certificate content.</p></div>
            </header>
            <dl className="certificate-record-facts">
              <div><dt>Certificate type</dt><dd>{certificateTitle}</dd></div>
              <div><dt>Certificate number</dt><dd>{certificate.certificate_number}</dd></div>
              <div><dt>Issue date</dt><dd>{formatDate(certificate.issued_on)}</dd></div>
              <div><dt>Record status</dt><dd>Issued</dd></div>
              <div><dt>Student name</dt><dd>{studentName || "—"}</dd></div>
              <div><dt>Student ID</dt><dd>{student?.student_identifier ?? valueFor(content.studentIdentifier)}</dd></div>
              <div><dt>Admission number</dt><dd>{student?.admission_number ?? valueFor(content.admissionNumber)}</dd></div>
              {detailEntries.map(([key, value]) => (
                <div className="certificate-record-fact-wide" key={key}>
                  <dt>{labelFor(key)}</dt><dd>{valueFor(value)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="student-panel certificate-record-panel">
            <header className="certificate-record-section-heading">
              <div><h2>Student ID card</h2><p>Current student identity and enrollment preview.</p></div>
              {student && <Link className="text-action" href={`/students/${student.id}/id-card`}>Full card / print →</Link>}
            </header>
            {student ? (
              <>
                <article className="student-id-card certificate-record-id-card">
                  <header className="student-id-card__school">
                    {school.logoUrl && <Image src={school.logoUrl} alt="" width={48} height={42} unoptimized />}
                    <div><strong>{school.name}</strong><span>STUDENT ID CARD</span></div>
                  </header>
                  <div className="student-id-card__body">
                    {photoUrl
                      ? <Image className="student-id-card__photo" src={photoUrl} alt={`${studentName} student photo`} width={104} height={124} unoptimized />
                      : <div className="student-id-card__photo student-id-card__photo--empty" aria-label="No student photo">
                        {studentName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "—"}
                      </div>}
                    <div className="student-id-card__details">
                      <h3>{studentName || "Student"}</h3>
                      <p><span>Student ID</span><strong>{student.student_identifier ?? "—"}</strong></p>
                      <p><span>Admission no.</span><strong>{student.admission_number ?? "—"}</strong></p>
                      <p><span>Class / section</span><strong>{[enrollmentClass?.name, enrollmentSection?.name].filter(Boolean).join(" / ") || "Not currently enrolled"}</strong></p>
                      <p><span>Academic session</span><strong>{enrollmentSession?.name ?? "—"}</strong></p>
                      {enrollment?.roll_number && <p><span>Roll no.</span><strong>{enrollment.roll_number}</strong></p>}
                    </div>
                  </div>
                  <footer className="student-id-card__footer">
                    <span>{school.phone ?? school.email ?? school.code}</span>
                    <span>{schoolLocation || school.code}</span>
                  </footer>
                </article>
                <p className="certificate-record-card-note">The card preview shows the student’s current profile and enrollment. Open the full card to view both sides and print it.</p>
              </>
            ) : (
              <p className="certificate-record-card-note">The student profile is no longer available. Certificate snapshot details are shown above.</p>
            )}
          </section>
        </div>
        <aside className="certificate-record-student-panel">
          <div className="certificate-record-student-heading">
            {photoUrl
              ? <Image src={photoUrl} alt={`${studentName} student photo`} width={72} height={72} unoptimized />
              : <span aria-hidden="true">{studentName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "—"}</span>}
            <div><h2>{studentName || "Student"}</h2><p>Student profile</p></div>
          </div>
          <dl className="certificate-record-student-facts">
            <div><dt>Student ID</dt><dd>{student?.student_identifier ?? valueFor(content.studentIdentifier)}</dd></div>
            <div><dt>Admission no.</dt><dd>{student?.admission_number ?? valueFor(content.admissionNumber)}</dd></div>
            <div><dt>Date of birth</dt><dd>{formatDate(student?.date_of_birth ?? (typeof content.dateOfBirth === "string" ? content.dateOfBirth : null))}</dd></div>
            <div><dt>Gender</dt><dd>{student?.gender?.replaceAll("_", " ") ?? "—"}</dd></div>
            <div><dt>Phone</dt><dd>{student?.phone ?? "—"}</dd></div>
          </dl>
          {student && <Link className="certificate-record-profile-link" href={`/students/${student.id}`}>Open student profile →</Link>}
        </aside>
      </div>
    </main>
  );
}
