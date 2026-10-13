import Link from "next/link";
import { notFound } from "next/navigation";

import { PromotionForm } from "@/components/students/promotion-form";
import { requireStudentContext } from "@/lib/students/context";

function relation<T>(value: unknown): T | null {
  return Array.isArray(value) ? ((value[0] ?? null) as T | null) : (value as T | null);
}

type Query = Promise<{ session?: string }>;

export default async function StudentPromotionsPage({ searchParams }: { searchParams: Query }) {
  const { session: sourceSessionId } = await searchParams;
  if (!sourceSessionId) notFound();

  const { supabase, schoolId, user } = await requireStudentContext("view");
  const [{ data: sourceSession, error: sourceError }, { data: roleRows, error: roleError }] = await Promise.all([
    supabase.from("academic_sessions").select("id,name,starts_on,ends_on,status").eq("id", sourceSessionId).eq("school_id", schoolId).maybeSingle(),
    supabase.from("user_roles").select("roles(slug)").eq("school_id", schoolId).eq("user_id", user.id),
  ]);
  if (sourceError || roleError) throw new Error("Promotion review access could not be loaded.");
  if (!sourceSession) notFound();

  const roleSlugs = (roleRows ?? [])
    .map((row) => relation<{ slug: string }>(row.roles)?.slug)
    .filter((slug): slug is string => Boolean(slug));
  const isSchoolAdmin = roleSlugs.some((slug) => ["school_admin", "principal", "super_admin"].includes(slug));
  const { data: teacher, error: teacherError } = isSchoolAdmin
    ? { data: null, error: null }
    : await supabase.from("teachers").select("id").eq("school_id", schoolId).eq("profile_id", user.id).eq("employment_status", "active").maybeSingle();
  if (teacherError) throw new Error("Class-teacher assignment could not be loaded.");
  if (!isSchoolAdmin && (!roleSlugs.includes("teacher") || !teacher)) notFound();

  const [{ data: exams, error: examError }, { data: nextSessions, error: nextSessionError }] = await Promise.all([
    supabase.from("exams").select("id,status").eq("school_id", schoolId).eq("academic_session_id", sourceSessionId),
    supabase.from("academic_sessions").select("id,name,starts_on").eq("school_id", schoolId).gt("starts_on", sourceSession.ends_on).neq("status", "archived").order("starts_on").limit(1),
  ]);
  if (examError || nextSessionError) throw new Error("Session results or the next session could not be loaded.");
  const allResultsPublished = Boolean(exams?.length) && exams!.every((exam) => exam.status === "published");
  const nextSession = nextSessions?.[0] ?? null;

  const [{ data: enrollments, error: enrollmentError }, { data: classes, error: classError }, { data: sections, error: sectionError }, { data: existingEnrollments, error: existingError }, { data: resultRows, error: resultError }] = await Promise.all([
    supabase.from("student_enrollments").select("id,student_id,class_id,section_id,roll_number,students(id,first_name,middle_name,last_name,admission_number),classes(name),sections(name,class_teacher_id)").eq("school_id", schoolId).eq("academic_session_id", sourceSessionId).eq("status", "active").order("created_at"),
    supabase.from("classes").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("sections").select("id,name,class_id").eq("school_id", schoolId).eq("status", "active").order("name"),
    nextSession ? supabase.from("student_enrollments").select("student_id").eq("school_id", schoolId).eq("academic_session_id", nextSession.id) : Promise.resolve({ data: [], error: null }),
    supabase.from("published_exam_results").select("exam_id,exam_name,exam_subject_id,student_id,class_id,subject_name,obtained_marks,maximum_marks,percentage,grade").eq("school_id", schoolId).eq("academic_session_id", sourceSessionId).order("exam_name").order("subject_name"),
  ]);
  if (enrollmentError || classError || sectionError || existingError || resultError) throw new Error("Promotion roster or published marks could not be loaded.");

  const nextSessionStudentIds = new Set((existingEnrollments ?? []).map((enrollment) => enrollment.student_id));
  const roster = (enrollments ?? []).filter((enrollment) => {
    if (teacher && relation<{ class_teacher_id: string | null }>(enrollment.sections)?.class_teacher_id !== teacher.id) return false;
    return true;
  });
  const canPromote = sourceSession.status === "completed" && allResultsPublished && Boolean(nextSession);

  return (
    <main className="students-shell">
      <header className="students-header">
        <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
        <Link className="text-action" href="/notifications">Notifications -&gt;</Link>
      </header>
      <section className="students-heading">
        <div>
          <p className="eyebrow">Academic progression</p>
          <h1>Promotion review.</h1>
          <p>{sourceSession.name} · {nextSession ? `Next session: ${nextSession.name}` : "Next session not configured"}</p>
        </div>
      </section>
      {!allResultsPublished && <div className="promotion-notice">Promotion review opens after every exam result for this session is published.</div>}
      {allResultsPublished && sourceSession.status !== "completed" && <div className="promotion-notice">Results are ready. Mark the academic session completed before enrolling promoted students into the next session.</div>}
      {allResultsPublished && !nextSession && <div className="promotion-notice">Create a later academic session in Setup before promoting students.</div>}
      {!roster.length ? (
        <div className="student-empty"><h3>No assigned students to review</h3><p>{teacher ? "There are no active enrollments in your assigned sections for this session." : "No active student enrollments were found for this session."}</p></div>
      ) : (
        <div className="promotion-roster">
          {roster.map((enrollment) => {
            const student = relation<{ id: string; first_name: string; middle_name: string | null; last_name: string; admission_number: string }>(enrollment.students);
            const classRow = relation<{ name: string }>(enrollment.classes);
            const sectionRow = relation<{ name: string; class_teacher_id: string | null }>(enrollment.sections);
            const alreadyEnrolled = nextSessionStudentIds.has(String(enrollment.student_id));
            const marks = (resultRows ?? []).filter((row) => row.student_id === enrollment.student_id && row.class_id === enrollment.class_id);
            const average = marks.length ? (marks.reduce((sum, row) => sum + Number(row.percentage ?? 0), 0) / marks.length).toFixed(1) : null;
            const fullName = [student?.first_name, student?.middle_name, student?.last_name].filter(Boolean).join(" ");
            return (
              <article className="promotion-card" key={String(enrollment.id)}>
                <div className="promotion-card__student">
                  <strong>{fullName || "Student"}</strong>
                  <span>{student?.admission_number ?? "—"} · {classRow?.name ?? "—"} / {sectionRow?.name ?? "—"}</span>
                  {enrollment.roll_number && <small>Current roll no. {String(enrollment.roll_number)}</small>}
                  {marks.length ? (
                    <details className="promotion-results">
                      <summary>Published results · {average}% average · {marks.length} subject{marks.length === 1 ? "" : "s"}</summary>
                      <ul>{marks.map((mark) => <li key={`${mark.exam_id}-${mark.exam_subject_id}`}><span>{mark.exam_name} · {mark.subject_name}</span><strong>{mark.obtained_marks}/{mark.maximum_marks} · {mark.grade ?? "—"}</strong></li>)}</ul>
                    </details>
                  ) : <small>No published marks are available for this student.</small>}
                </div>
                {alreadyEnrolled
                  ? <span className="status-pill active">Already enrolled in next session</span>
                  : canPromote && nextSession && marks.length > 0
                    ? <PromotionForm studentId={String(enrollment.student_id)} sourceSessionId={sourceSessionId} targetSessionId={nextSession.id} classes={classes ?? []} sections={sections ?? []} />
                    : <span className="student-muted">{marks.length ? "Pending session completion" : "Awaiting published marks"}</span>}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
