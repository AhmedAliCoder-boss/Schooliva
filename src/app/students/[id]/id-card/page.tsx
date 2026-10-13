import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

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

  return (
    <main className="student-id-card-page">
      <div className="student-id-card-toolbar no-print">
        <Link href={`/students/${id}`}>Back to student profile</Link>
        <PrintAction label="Print ID card / Save PDF" />
      </div>
      <article className="student-id-card" aria-label={`${fullName} student ID card`}>
        <header className="student-id-card__school">
          {school.logoUrl && <Image src={school.logoUrl} alt="" width={48} height={42} unoptimized />}
          <div><strong>{school.name}</strong><span>STUDENT ID CARD</span></div>
        </header>
        <div className="student-id-card__body">
          {photoUrl ? <Image className="student-id-card__photo" src={photoUrl} alt={`${fullName} student photo`} width={94} height={112} unoptimized /> : <div className="student-id-card__photo student-id-card__photo--empty">Photo</div>}
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
      <p className="student-id-card-note no-print">Print this card on an ID-card sheet or save it as PDF for printing.</p>
    </main>
  );
}
