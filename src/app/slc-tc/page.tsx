import Link from "next/link";
import { redirect } from "next/navigation";

import { SlcTcWorkflow, type SlcTcClassSectionOption, type SlcTcHistoryRow, type SlcTcPendingApprovalRow, type SlcTcSessionOption, type SlcTcStudentOption } from "@/components/documents/slc-tc-workflow";
import { requireDocumentContext } from "@/lib/documents/context";
import { nextFourDigitCertificateNumber } from "@/lib/documents/schemas";
import { hasStudentProfileEditRole } from "@/lib/students/permissions";

type Relation<T> = T | T[] | null;
type ClassRelation = { name: string | null };
type SessionRelation = { name: string | null };
type EnrollmentRow = {
  student_id: string;
  enrolled_on: string;
  class_id: string;
  section_id: string;
  academic_session_id: string;
  classes: Relation<ClassRelation>;
  sections: Relation<ClassRelation>;
  academic_sessions: Relation<SessionRelation>;
};
type HistoryStudent = {
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  student_identifier: string | null;
};
type HistoryRecord = {
  id: string;
  certificate_number: string;
  certificate_type?: string;
  issued_on: string;
  content: unknown;
  students: Relation<HistoryStudent>;
};

function relation<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function currentDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function SlcTcPage() {
  const { supabase, schoolId, user } = await requireDocumentContext("manage");
  const { data: canManageCertificates, error: permissionError } = await supabase.rpc("has_permission", {
    target_school_id: schoolId,
    target_resource: "certificates",
    target_action: "manage",
  });
  if (permissionError) {
    console.error("SLC/TC page permission could not be checked.", permissionError);
    throw new Error("SLC/TC permissions could not be verified.");
  }
  if (!canManageCertificates) redirect("/dashboard?error=not-authorized");

  const pageSize = 500;
  const studentRecords: Array<{
    id: string;
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    student_identifier: string | null;
    admission_number: string | null;
    date_of_birth: string | null;
    admission_date: string | null;
  }> = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from("students")
      .select("id,first_name,middle_name,last_name,student_identifier,admission_number,date_of_birth,admission_date")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .order("last_name")
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("Active students could not be loaded for SLC/TC.", error);
      throw new Error("Active students could not be loaded for SLC/TC.");
    }
    studentRecords.push(...(data ?? []));
    if ((data?.length ?? 0) < pageSize) break;
  }

  const enrollmentRecords: EnrollmentRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from("student_enrollments")
      .select("student_id,enrolled_on,class_id,section_id,academic_session_id,classes(name),sections(name),academic_sessions(name)")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .order("enrolled_on", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("Active enrollments could not be loaded for SLC/TC.", error);
      throw new Error("Active enrollments could not be loaded for SLC/TC.");
    }
    enrollmentRecords.push(...((data ?? []) as EnrollmentRow[]));
    if ((data?.length ?? 0) < pageSize) break;
  }
  const [
    { data: classes, error: classesError },
    { data: sections, error: sectionsError },
    { data: activeSessions, error: sessionsError },
  ] = await Promise.all([
    supabase.from("classes").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("sections").select("id,name,class_id").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("academic_sessions").select("id,name").eq("school_id", schoolId).eq("status", "active").order("starts_on", { ascending: false }),
  ]);
  if (classesError || sectionsError || sessionsError) {
    console.error("Active SLC/TC class and session options could not be loaded.", { classesError, sectionsError, sessionsError });
    throw new Error("Active classes, sections, or academic sessions could not be loaded.");
  }
  const classNames = new Map((classes ?? []).map((row) => [String(row.id), String(row.name)]));
  const classSectionOptions: SlcTcClassSectionOption[] = (sections ?? [])
    .filter((section) => classNames.has(String(section.class_id)))
    .map((section) => ({
      classId: String(section.class_id),
      sectionId: String(section.id),
      className: classNames.get(String(section.class_id))!,
      sectionName: String(section.name),
    }));
  const sessionOptions: SlcTcSessionOption[] = (activeSessions ?? []).map((session) => ({
    id: String(session.id),
    name: String(session.name),
  }));
  const certificateNumbers: string[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from("certificate_records")
      .select("certificate_number")
      .eq("school_id", schoolId)
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("Existing certificate numbers could not be loaded.", error);
      throw new Error("A new certificate number could not be generated.");
    }
    certificateNumbers.push(...(data ?? []).map((row) => row.certificate_number));
    if ((data?.length ?? 0) < pageSize) break;
  }
  const nextCertificateNumber = nextFourDigitCertificateNumber(certificateNumbers);
  const enrollmentByStudent = new Map<string, EnrollmentRow>();
  for (const enrollment of enrollmentRecords) {
    if (!enrollmentByStudent.has(enrollment.student_id)) enrollmentByStudent.set(enrollment.student_id, enrollment);
  }
  const studentOptions: SlcTcStudentOption[] = studentRecords
    .filter((student) => enrollmentByStudent.has(student.id))
    .map((student) => {
      const enrollment = enrollmentByStudent.get(student.id)!;
      const classRecord = relation(enrollment.classes);
      const sectionRecord = relation(enrollment.sections);
      const sessionRecord = relation(enrollment.academic_sessions);
      return {
        id: student.id,
        name: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" "),
        studentId: student.student_identifier ?? "",
        admissionNumber: student.admission_number ?? "",
        dateOfBirth: student.date_of_birth ?? "",
        admissionDate: student.admission_date ?? "",
        classId: enrollment.class_id,
        sectionId: enrollment.section_id,
        academicSessionId: enrollment.academic_session_id,
        className: classRecord?.name ?? "",
        sectionName: sectionRecord?.name ?? "",
        sessionName: sessionRecord?.name ?? "",
      };
    });

  const [
    { data: historyData, error: historyError },
    { data: pendingData, error: pendingError },
    { data: currentRoles, error: rolesError },
  ] = await Promise.all([
    supabase.from("certificate_records")
    .select("id,certificate_number,certificate_type,issued_on,content,students(first_name,middle_name,last_name,student_identifier)")
    .eq("school_id", schoolId)
    .in("certificate_type", ["leaving", "character"])
    .eq("status", "issued")
    .order("issued_on", { ascending: false })
    .limit(500),
    supabase.from("certificate_records")
      .select("id,certificate_number,certificate_type,issued_on,content,students(first_name,middle_name,last_name,student_identifier)")
      .eq("school_id", schoolId)
      .in("certificate_type", ["leaving", "character"])
      .eq("status", "pending_approval")
      .order("issued_on", { ascending: true })
      .limit(500),
    supabase.from("user_roles")
      .select("roles(slug)")
      .eq("user_id", user.id)
      .eq("school_id", schoolId),
  ]);
  if (historyError || pendingError || rolesError) {
    console.error("Certificate history, approval queue, or approver roles could not be loaded.", { historyError, pendingError, rolesError });
    throw new Error("Certificate history or approval queue could not be loaded.");
  }
  const history: SlcTcHistoryRow[] = ((historyData ?? []) as HistoryRecord[]).map((record) => {
    const student = relation(record.students);
    const content = record.content && typeof record.content === "object"
      ? record.content as { certificateTitle?: string; studentName?: string; studentIdentifier?: string }
      : {};
    return {
      id: record.id,
      certificateNumber: record.certificate_number,
      certificateTitle: content.certificateTitle ?? "Leaving certificate",
      issuedOn: record.issued_on,
      studentName: content.studentName ?? [student?.first_name, student?.middle_name, student?.last_name].filter(Boolean).join(" "),
      studentId: content.studentIdentifier ?? student?.student_identifier ?? "",
    };
  });
  const pendingApprovals: SlcTcPendingApprovalRow[] = ((pendingData ?? []) as HistoryRecord[]).map((record) => {
    const student = relation(record.students);
    const content = record.content && typeof record.content === "object"
      ? record.content as { certificateTitle?: string; certificateKind?: string; certificateNumber?: string; studentName?: string; studentIdentifier?: string }
      : {};
    return {
      id: record.id,
      certificateNumber: record.certificate_number,
      certificateTitle: content.certificateTitle ?? (record.certificate_type === "character" ? "Character Certificate" : "Leaving certificate"),
      certificateType: record.certificate_type === "character" ? "character" : "leaving",
      issuedOn: record.issued_on,
      studentName: content.studentName ?? [student?.first_name, student?.middle_name, student?.last_name].filter(Boolean).join(" "),
      studentId: content.studentIdentifier ?? student?.student_identifier ?? "",
    };
  });
  const canApproveCertificates = hasStudentProfileEditRole(currentRoles ?? []);

  return <main className="slc-tc-shell">
    <header className="students-header">
      <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
      <div><Link className="text-action" href="/students">Students →</Link><Link className="text-action students-header-link" href="/documents">Documents →</Link></div>
    </header>
    <section className="module-page-header">
      <div className="module-page-header__row"><div>
        <p className="module-page-header__eyebrow">Academics / Student certificates</p>
        <h1>Student certificates.</h1>
        <p>Issue character certificates, school leaving certificates, or transfer certificates from the student record.</p>
      </div></div>
    </section>
    <SlcTcWorkflow students={studentOptions} history={history} pendingApprovals={pendingApprovals} canApproveCertificates={canApproveCertificates} today={currentDate()} classSections={classSectionOptions} sessions={sessionOptions} nextCertificateNumber={nextCertificateNumber} />
  </main>;
}
