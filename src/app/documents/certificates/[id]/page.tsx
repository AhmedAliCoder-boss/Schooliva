import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintAction } from "@/components/print/print-action";
import { createClient } from "@/lib/supabase/server";

type Student = {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  admission_number?: string | null;
  student_identifier?: string | null;
};
type School = { name?: string | null; address?: string | null; phone?: string | null; email?: string | null; code?: string | null };
type Relation<T> = T | T[] | null;
type SlcTcContent = {
  text?: string;
  certificateTitle?: string;
  studentName?: string;
  studentIdentifier?: string;
  admissionNumber?: string;
  dateOfAdmission?: string;
  dateOfLeaving?: string;
  dateOfBirth?: string;
  certificateKind?: "character" | "slc_tc" | "completion";
  lastClassAttended?: string;
  academicSession?: string;
  reasonForLeaving?: string;
  conduct?: string;
  feeStatus?: "cleared" | "pending" | "waived" | "not_recorded";
  lastExam?: string;
  promotionStatus?: string;
  remarks?: string;
  certificateText?: string;
};

function relation<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function displayDate(value: string | null | undefined) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: certificate, error } = await supabase.from("certificate_records")
    .select("id,certificate_type,certificate_number,issued_on,status,content,students(first_name,middle_name,last_name,admission_number,student_identifier),schools(name,address,phone,email,code)")
    .eq("id", id)
    .eq("status", "issued")
    .maybeSingle();
  if (error) {
    console.error("Certificate record could not be loaded.", error);
    throw new Error("Certificate could not be loaded.");
  }
  if (!certificate) notFound();

  const student = relation<Student>(certificate.students);
  const school = relation<School>(certificate.schools);
  const content = certificate.content && typeof certificate.content === "object" ? certificate.content as SlcTcContent : {};
  const studentName = content.studentName || [student?.first_name, student?.middle_name, student?.last_name].filter(Boolean).join(" ");
  const isSlcTc = ["leaving", "completion"].includes(certificate.certificate_type) && Boolean(content.certificateTitle);
  const isCompletionCertificate = certificate.certificate_type === "completion";
  const isCharacterCertificate = certificate.certificate_type === "character" && content.certificateKind === "character";
  const isCustomStudentCertificate = isSlcTc || isCharacterCertificate;

  return <main className={`certificate-page${isSlcTc ? " slc-tc-print-page" : ""}${isCharacterCertificate ? " character-certificate-page" : ""}`}>
    <header className="students-header no-print">
      <Link className="wordmark" href={isCustomStudentCertificate ? "/slc-tc" : "/documents"}><span className="wordmark-mark">S</span><span>schooliva</span></Link>
      <PrintAction label={isCustomStudentCertificate ? "Print / Save as PDF" : "Print certificate"} />
    </header>
    {isCharacterCertificate ? <article className="character-certificate">
      <div className="character-certificate__border">
        <header className="character-certificate__school">
          <span className="character-certificate__crest" aria-hidden="true">S</span>
          <p>OFFICIAL STUDENT RECORD</p>
          <h1>{school?.name ?? "School"}</h1>
          <span>{[school?.address, school?.phone, school?.email].filter(Boolean).join(" · ") || `School code: ${school?.code ?? "—"}`}</span>
        </header>
        <p className="character-certificate__overline">To whom it may concern</p>
        <h2>Character Certificate</h2>
        <p className="character-certificate__number">Certificate No. {String(certificate.certificate_number)}</p>
        <p className="character-certificate__statement">{content.certificateText || content.text || `This is to certify that ${studentName} has been a student of this school. During the period of study, the student's conduct and character were found to be ${content.conduct ?? "satisfactory"}. We wish the student success in future endeavours.`}</p>
        <dl className="character-certificate__facts">
          <div><dt>Student</dt><dd>{studentName || "—"}</dd></div>
          <div><dt>Schooliva student ID</dt><dd>{content.studentIdentifier || student?.student_identifier || "—"}</dd></div>
          <div><dt>Admission number</dt><dd>{content.admissionNumber || student?.admission_number || "—"}</dd></div>
          {content.conduct && <div><dt>Conduct</dt><dd>{content.conduct}</dd></div>}
        </dl>
        {content.remarks && <p className="character-certificate__remarks">{content.remarks}</p>}
        <footer className="character-certificate__footer">
          <span>Issued on {displayDate(certificate.issued_on)}</span>
          <div><i></i><strong>Class teacher</strong></div>
          <div><i></i><strong>Principal / Head</strong></div>
          <div><i></i><strong>School stamp</strong></div>
        </footer>
      </div>
    </article> : isSlcTc ? <article className="slc-tc-certificate">
      <div className="slc-tc-certificate__border">
        <header className="slc-tc-certificate__school">
          <span className="slc-tc-certificate__crest" aria-hidden="true">S</span>
          <div><p>OFFICIAL STUDENT RECORD</p><h1>{school?.name ?? "School"}</h1><span>{[school?.address, school?.phone, school?.email].filter(Boolean).join(" · ") || `School code: ${school?.code ?? "—"}`}</span></div>
        </header>
        <div className="slc-tc-certificate__title">
          <h2>{content.certificateTitle}</h2>
          <span>Certificate No. {String(certificate.certificate_number)}</span>
        </div>
        <p className="slc-tc-certificate__intro">{isCompletionCertificate ? "This is to certify that the student has successfully completed the stated academic requirements at this school." : "This is to certify that the following particulars are true and recorded in the school register."}</p>
        <dl className="slc-tc-certificate__facts">
          <div><dt>Student name</dt><dd>{studentName || "—"}</dd></div>
          <div><dt>Schooliva student ID</dt><dd>{content.studentIdentifier || student?.student_identifier || "—"}</dd></div>
          <div><dt>Admission number</dt><dd>{content.admissionNumber || student?.admission_number || "—"}</dd></div>
          <div><dt>Date of birth</dt><dd>{displayDate(content.dateOfBirth)}</dd></div>
          <div><dt>Date of admission</dt><dd>{displayDate(content.dateOfAdmission)}</dd></div>
          <div><dt>{isCompletionCertificate ? "Completion date" : "Date of leaving"}</dt><dd>{displayDate(content.dateOfLeaving)}</dd></div>
          <div><dt>Last class attended</dt><dd>{content.lastClassAttended || "—"}</dd></div>
          <div><dt>Academic session</dt><dd>{content.academicSession || "—"}</dd></div>
          <div><dt>Last examination</dt><dd>{content.lastExam || "—"}</dd></div>
          <div><dt>Promotion status</dt><dd>{content.promotionStatus || "—"}</dd></div>
          <div><dt>Conduct</dt><dd>{content.conduct || "—"}</dd></div>
          <div><dt>Fee status</dt><dd>{content.feeStatus ? content.feeStatus.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase()) : "—"}</dd></div>
        </dl>
        <section className="slc-tc-certificate__statement"><h3>{isCompletionCertificate ? "Completion details" : "Reason for leaving / transfer"}</h3><p>{content.reasonForLeaving || content.text || "—"}</p></section>
        {content.remarks && <section className="slc-tc-certificate__statement"><h3>Additional remarks</h3><p>{content.remarks}</p></section>}
        <footer className="slc-tc-certificate__footer">
          <span>Issued on {displayDate(certificate.issued_on)}</span>
          <div><i></i><strong>Class teacher</strong></div>
          <div><i></i><strong>Principal / Head</strong></div>
          <div><i></i><strong>School stamp</strong></div>
        </footer>
      </div>
    </article> : <article className="certificate-sheet">
      <p className="eyebrow">{school?.name ?? "Schooliva"}</p>
      <h1>{String(certificate.certificate_type).replace("_", " ").toUpperCase()} CERTIFICATE</h1>
      <p className="certificate-number">Certificate no: {String(certificate.certificate_number)}</p>
      <p>This is to certify that</p>
      <h2>{studentName}</h2>
      <p>Admission number: {student?.admission_number ?? "-"}</p>
      <p className="certificate-content">{content.text ?? "This certificate is issued from the official Schooliva school record."}</p>
      <p>Issued on {String(certificate.issued_on)}</p>
      <div className="certificate-signatures"><span>Class teacher</span><span>Principal / Head</span></div>
    </article>}
  </main>;
}
