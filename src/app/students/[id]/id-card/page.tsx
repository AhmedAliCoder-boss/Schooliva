import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { PrintAction } from "@/components/print/print-action";
import { requireStudentContext } from "@/lib/students/context";
import { getSchoolDocumentIdentity } from "@/lib/print/school-document";

type Relation = { name: string } | { name: string }[] | null;

function relationName(value: Relation) {
  return Array.isArray(value) ? value[0]?.name ?? "—" : value?.name ?? "—";
}

export default async function StudentIdCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, schoolId } = await requireStudentContext("view");
  const { data: student, error } = await supabase.from("students")
    .select("id,admission_number,student_identifier,first_name,middle_name,last_name,date_of_birth,gender,phone,photo_path")
    .eq("id", id)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw new Error("Student details could not be loaded for the ID card.");
  if (!student) notFound();

  const [{ data: enrollment, error: enrollmentError }, school] = await Promise.all([
    supabase.from("student_enrollments")
      .select("roll_number,classes(name),sections(name),academic_sessions(name)")
      .eq("student_id", id)
      .eq("school_id", schoolId)
      .eq("status", "active")
      .order("enrolled_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getSchoolDocumentIdentity(supabase, schoolId),
  ]);
  if (enrollmentError) throw new Error("Student enrollment details could not be loaded for the ID card.");

  let photoUrl: string | null = null;
  if (student.photo_path) {
    const { data, error: photoError } = await supabase.storage.from("admission-documents").createSignedUrl(student.photo_path, 3600);
    if (photoError) throw new Error("Student photo could not be prepared for the ID card.");
    photoUrl = data.signedUrl;
  }

  const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ");
  const className = relationName(enrollment?.classes ?? null);
  const sectionName = relationName(enrollment?.sections ?? null);
  const sessionName = relationName(enrollment?.academic_sessions ?? null);
  const schoolLocation = [school.address, school.city, school.state, school.postal_code, school.country]
    .filter(Boolean)
    .join(", ");
  const qrCode = await QRCode.toDataURL(
    `Schooliva student card\nSchool: ${school.code}\nStudent ID: ${student.student_identifier}\nAdmission: ${student.admission_number}`,
    { errorCorrectionLevel: "M", margin: 1, width: 240, color: { dark: "#102a4c", light: "#ffffff" } },
  );

  return (
    <main className="student-id-card-page employee-id-card-page">
      <div className="student-id-card-toolbar no-print">
        <Link href={`/students/${id}`}>Back to student profile</Link>
        <PrintAction label="Print both sides / Save PDF" />
      </div>
      <div className="employee-id-card-sides">
      <article className="student-id-card employee-id-card employee-id-card--side employee-id-card--front" aria-label={`${fullName} student ID card front`}>
        <header className="student-id-card__school">
          {school.logoUrl && <Image src={school.logoUrl} alt="" width={48} height={42} unoptimized />}
          <div><strong>{school.name}</strong><span>STUDENT ID CARD</span></div>
        </header>
        <div className="student-id-card__body">
          {photoUrl ? <Image className="student-id-card__photo" src={photoUrl} alt={`${fullName} student photo`} width={94} height={112} unoptimized /> : <div className="student-id-card__photo student-id-card__photo--empty">{fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>}
          <div className="student-id-card__details">
            <h1>{fullName}</h1>
            <p><span>Student ID</span><strong>{student.student_identifier}</strong></p>
            <p><span>Admission no.</span><strong>{student.admission_number}</strong></p>
            <p><span>Class / section</span><strong>{className} / {sectionName}</strong></p>
            <p><span>Academic session</span><strong>{sessionName}</strong></p>
            {enrollment?.roll_number && <p><span>Roll no.</span><strong>{enrollment.roll_number}</strong></p>}
            {student.date_of_birth && <p><span>Date of birth</span><strong>{new Date(`${student.date_of_birth}T00:00:00`).toLocaleDateString()}</strong></p>}
          </div>
        </div>
        <footer className="student-id-card__footer">
          <span>{school.phone ?? school.email ?? school.code}</span>
          <span>Valid for the academic session shown</span>
        </footer>
      </article>
      <article className="employee-id-card__back employee-id-card--side" aria-label={`${fullName} student ID card back`}>
        <header className="employee-id-card__back-heading">
          {school.logoUrl && <Image src={school.logoUrl} alt="" width={42} height={38} unoptimized />}
          <div><strong>{school.name}</strong><span>STUDENT IDENTIFICATION</span></div>
        </header>
        <div className="employee-id-card__back-content">
          <div className="employee-id-card__qr-wrap">
            <Image className="employee-id-card__qr" src={qrCode} alt="QR code with the school code and student identifiers" width={88} height={88} unoptimized />
            <span>Scan for card details</span>
          </div>
          <div className="employee-id-card__back-details">
            <span className="employee-id-card__back-label">SCHOOL LOCATION</span>
            <strong>{schoolLocation || `School code: ${school.code}`}</strong>
            <span className="employee-id-card__back-label">CARD POLICY</span>
            <p>This card remains the property of {school.name} and must be presented on campus.</p>
            <p>If found, please return it to {school.phone ?? school.email ?? school.name}.</p>
          </div>
        </div>
        <footer className="employee-id-card__back-footer">
          <span>Powered by</span><strong>Schooliva</strong>
        </footer>
      </article>
      </div>
      <p className="student-id-card-note no-print">Print double-sided at 100% scale (flip on the long edge). Each side is 85.6 × 54 mm.</p>
    </main>
  );
}
