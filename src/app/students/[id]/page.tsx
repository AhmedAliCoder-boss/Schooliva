import Link from "next/link";
import { notFound } from "next/navigation";

import { ArchiveStudentForm, DocumentForm, StudentForm } from "@/components/students/student-forms";
import { requireStudentContext } from "@/lib/students/context";
import { canEditStudentProfile } from "@/lib/students/permissions";

function relation<T>(value: unknown): T | null { return Array.isArray(value) ? (value[0] ?? null) as T : (value as T | null); }

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, schoolId, user } = await requireStudentContext("view");
  const [
    { data: student },
    { data: parents },
    { data: enrollments },
    { data: documents },
    { data: admission, error: admissionError },
  ] = await Promise.all([
    supabase.from("students").select("id,admission_number,student_identifier,first_name,middle_name,last_name,date_of_birth,gender,blood_group,nationality,status,phone,email,address,admission_date,emergency_contact_name,emergency_contact_phone,emergency_contact_relationship,medical_notes,previous_school").eq("id", id).eq("school_id", schoolId).maybeSingle(),
    supabase.from("student_parents").select("relationship,is_primary,parents(first_name,last_name,phone,email)").eq("student_id", id).eq("school_id", schoolId),
    supabase.from("student_enrollments").select("id,roll_number,enrolled_on,status,withdrawn_at,classes(name),sections(name),academic_sessions(name),academic_terms(name)").eq("student_id", id).eq("school_id", schoolId).order("enrolled_on", { ascending: false }),
    supabase.from("student_documents").select("id,document_type,document_name,storage_path,created_at,metadata").eq("student_id", id).eq("school_id", schoolId).order("created_at", { ascending: false }),
    supabase.from("admissions").select("guardian_name,guardian_phone,guardian_relationship").eq("student_id", id).eq("school_id", schoolId).maybeSingle(),
  ]);
  if (admissionError) throw new Error("Student guardian information could not be loaded.");
  if (!student) notFound();
  const record = {
    ...student,
    emergency_contact_name: student.emergency_contact_name ?? admission?.guardian_name ?? null,
    emergency_contact_phone: student.emergency_contact_phone ?? admission?.guardian_phone ?? null,
    emergency_contact_relationship: student.emergency_contact_relationship ?? admission?.guardian_relationship ?? "guardian",
  };
  const studentParents = (parents ?? []) as Array<Record<string, unknown>>;
  const guardianAlreadyListed = studentParents.some((item) => {
    const parent = relation<{ first_name: string; last_name: string; phone?: string }>(item.parents);
    const parentName = `${parent?.first_name ?? ""} ${parent?.last_name ?? ""}`.trim().toLowerCase();
    const guardianName = record.emergency_contact_name?.trim().toLowerCase();
    const parentPhone = parent?.phone?.trim();
    const guardianPhone = record.emergency_contact_phone?.trim();
    return Boolean(
      (guardianName && parentName === guardianName)
      || (guardianPhone && parentPhone === guardianPhone),
    );
  });
  const history = (enrollments ?? []) as Array<Record<string, unknown>>;
  const documentRows = (documents ?? []) as Array<Record<string, unknown>>;
  const canEdit = await canEditStudentProfile(supabase, schoolId, user.id);
  return (
    <main className="student-profile-shell">
      <header className="students-header">
        <Link className="wordmark" href="/">
          <span className="wordmark-mark">S</span><span>schooliva</span>
        </Link>
        <Link className="text-action" href="/students">All students -&gt;</Link>
      </header>
      <section className="student-profile-heading">
        <div>
          <p className="eyebrow">Student profile</p>
          <h1>{record.first_name} {record.last_name}</h1>
          <p>Admission no. <strong>{record.admission_number}</strong></p>
          <p>Student ID <strong>{record.student_identifier}</strong></p>
        </div>
        <div className="student-profile-heading__actions">
          <span className={`status-pill ${record.status}`}>{record.status}</span>
          <Link href={`/students/${id}/id-card`} className="student-primary-action">Generate ID card</Link>
        </div>
      </section>
      <div className="student-profile-grid">
        <section className="student-panel">
          <div className="student-panel-heading"><h2>Identity and contact</h2><span>Permanent record</span></div>
          <StudentForm student={record} editable={canEdit} />
        </section>
        <aside className="student-profile-aside">
          <section className="student-panel">
            <div className="student-panel-heading"><h2>Parents & guardians</h2></div>
            {studentParents.length ? (
              <ul className="relationship-list">
                {studentParents.map((item, index) => {
                  const parent = relation<{ first_name: string; last_name: string; phone?: string; email?: string }>(item.parents);
                  return <li key={index}><strong>{parent?.first_name} {parent?.last_name}</strong><span>{String(item.relationship ?? "guardian")}</span><small>{parent?.phone ?? parent?.email ?? "No contact"}</small></li>;
                })}
                {(record.emergency_contact_name || record.emergency_contact_phone) && !guardianAlreadyListed && <li><strong>{record.emergency_contact_name || "Guardian"}</strong><span>{record.emergency_contact_relationship} / emergency contact</span><small>{record.emergency_contact_phone || "No phone recorded"}</small></li>}
              </ul>
            ) : record.emergency_contact_name || record.emergency_contact_phone ? (
              <ul className="relationship-list">
                <li><strong>{record.emergency_contact_name || "Guardian"}</strong><span>{record.emergency_contact_relationship} (admission record)</span><small>{record.emergency_contact_phone || "No phone recorded"}</small></li>
              </ul>
            ) : <p className="student-muted">No parent relationships recorded.</p>}
          </section>
          <section className="student-panel">
            <div className="student-panel-heading"><h2>Enrollment history</h2><span>Read-only record</span></div>
            <p className="student-muted">Shows the class and section recorded for each academic session. Staff review results and promote students from the promotion workflow; past records stay here for reference.</p>
            {history.length ? (
              <ul className="enrollment-list">
                {history.map((item) => (
                  <li key={String(item.id)}>
                    <strong>{relation<{ name: string }>(item.classes)?.name ?? "-"} / {relation<{ name: string }>(item.sections)?.name ?? "-"}</strong>
                    <span>{relation<{ name: string }>(item.academic_sessions)?.name ?? "-"}{item.roll_number ? ` · Roll no. ${String(item.roll_number)}` : ""}</span>
                    <small>{String(item.enrolled_on)} · {String(item.status)}</small>
                  </li>
                ))}
              </ul>
            ) : <p className="student-muted">No enrollment history yet.</p>}
          </section>
          <section className="student-panel">
            <div className="student-panel-heading"><h2>Documents metadata</h2><span>Storage-ready</span></div>
            {documentRows.length ? (
              <ul className="relationship-list">
                {documentRows.map((item) => (
                  <li key={String(item.id)}><strong>{String(item.document_name)}</strong><span>{String(item.document_type)}</span><small>{String(item.created_at).slice(0, 10)}</small></li>
                ))}
              </ul>
            ) : <p className="student-muted">No document metadata recorded.</p>}
            {canEdit ? <DocumentForm studentId={id} /> : <p className="student-muted">Student documents are read-only for your account.</p>}
          </section>
          <section className="student-panel student-danger-panel">
            <h2>Student lifecycle</h2>
            {canEdit ? <>
              <p>Archive a student without deleting their historical identity or enrollment records.</p>
              <ArchiveStudentForm id={id} />
            </> : <p className="student-muted">Student lifecycle controls are read-only for your account.</p>}
          </section>
        </aside>
      </div>
    </main>
  );
}