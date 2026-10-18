import { redirect } from "next/navigation";

import { AssignmentsWorkspace } from "@/components/assignments/assignments-workspace";
import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { createClient } from "@/lib/supabase/server";

function relation<T>(value: unknown): T | null {
  return Array.isArray(value) ? (value[0] ?? null) as T | null : value as T | null;
}

export default async function AssignmentsPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/sign-in");
  const { schoolId, isMasterAdmin } = await getActiveSchoolContext(supabase, user.id);
  if (!schoolId) redirect(isMasterAdmin ? "/admin" : "/setup?onboarding=1");

  const permissionActions = ["view", "manage", "submit", "review"] as const;
  const permissionResults = await Promise.all(permissionActions.map((action) => supabase.rpc("has_permission", {
    target_school_id: schoolId,
    target_resource: "assignments",
    target_action: action,
  })));
  const permissionError = permissionResults.find((result) => result.error)?.error;
  if (permissionError) {
    console.error("Assignment permissions could not be verified.", permissionError);
    return <main className="students-shell assignments-shell"><p className="auth-error">Assignment access could not be verified. Refresh and try again.</p></main>;
  }
  const [canView, canManage, canSubmit, canReview] = permissionResults.map((result) => result.data === true);
  if (!canView && !canManage && !canSubmit && !canReview) redirect("/dashboard?error=not-authorized");

  const [
    { data: assignmentRows, error: assignmentsError },
    { data: studentRecord, error: studentError },
  ] = await Promise.all([
    supabase.from("assignments")
      .select("id,title,description,issue_date,due_date,status,max_marks,academic_session_id,class_id,section_id,subject_id,academic_sessions(name),classes(name),sections(name),subjects(name),teachers(first_name,last_name),assignment_submissions(id,student_id,content,status,marks,feedback,submitted_at,students(first_name,middle_name,last_name,student_identifier))")
      .eq("school_id", schoolId).order("due_date", { ascending: true }),
    canSubmit
      ? supabase.from("students").select("id").eq("school_id", schoolId).eq("profile_id", user.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (assignmentsError || studentError) {
    console.error("Assignment workspace data could not be loaded.", assignmentsError ?? studentError);
    return <main className="students-shell assignments-shell"><p className="auth-error">Assignments could not be loaded. Refresh and try again.</p></main>;
  }

  const rows = assignmentRows ?? [];
  const canLoadCatalogs = canManage;
  const [
    { data: sessions, error: sessionsError },
    { data: classes, error: classesError },
    { data: sections, error: sectionsError },
    { data: subjects, error: subjectsError },
    { data: teachers, error: teachersError },
    { data: enrollments, error: enrollmentsError },
  ] = await Promise.all([
    canLoadCatalogs
      ? supabase.from("academic_sessions").select("id,name,is_current").eq("school_id", schoolId).order("starts_on", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    canLoadCatalogs
      ? supabase.from("classes").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name")
      : Promise.resolve({ data: [], error: null }),
    canLoadCatalogs
      ? supabase.from("sections").select("id,name,class_id").eq("school_id", schoolId).eq("status", "active").order("name")
      : Promise.resolve({ data: [], error: null }),
    canLoadCatalogs
      ? supabase.from("subjects").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name")
      : Promise.resolve({ data: [], error: null }),
    canLoadCatalogs
      ? supabase.from("teachers").select("id,first_name,last_name").eq("school_id", schoolId)
        .eq("is_active", true).is("deleted_at", null).order("last_name")
      : Promise.resolve({ data: [], error: null }),
    (canManage || canReview) && rows.length
      ? supabase.from("student_enrollments").select("academic_session_id,class_id,section_id,student_id")
        .eq("school_id", schoolId).eq("status", "active")
        .in("academic_session_id", [...new Set(rows.map((row) => row.academic_session_id))])
        .in("class_id", [...new Set(rows.map((row) => row.class_id))])
        .in("section_id", [...new Set(rows.map((row) => row.section_id))])
      : Promise.resolve({ data: [], error: null }),
  ]);
  const catalogError = sessionsError ?? classesError ?? sectionsError ?? subjectsError ?? teachersError ?? enrollmentsError;
  if (catalogError) {
    console.error("Assignment setup or enrollment data could not be loaded.", catalogError);
    return <main className="students-shell assignments-shell"><p className="auth-error">Assignment setup data could not be loaded. Refresh and try again.</p></main>;
  }

  const enrollmentCounts = new Map<string, number>();
  for (const enrollment of enrollments ?? []) {
    const key = `${enrollment.academic_session_id}:${enrollment.class_id}:${enrollment.section_id}`;
    enrollmentCounts.set(key, (enrollmentCounts.get(key) ?? 0) + 1);
  }
  const assignments = rows.map((assignment) => {
    const assignmentSubmissions = Array.isArray(assignment.assignment_submissions) ? assignment.assignment_submissions : [];
    const teacher = relation<{ first_name: string; last_name: string }>(assignment.teachers);
    return {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description ?? "",
      issueDate: assignment.issue_date,
      dueDate: assignment.due_date,
      status: assignment.status,
      maxMarks: assignment.max_marks === null ? null : Number(assignment.max_marks),
      sessionName: relation<{ name: string }>(assignment.academic_sessions)?.name ?? "Academic session",
      className: relation<{ name: string }>(assignment.classes)?.name ?? "Class",
      sectionName: relation<{ name: string }>(assignment.sections)?.name ?? "Section",
      subjectName: relation<{ name: string }>(assignment.subjects)?.name ?? "Subject",
      teacherName: teacher ? `${teacher.first_name} ${teacher.last_name}`.trim() : "",
      expectedSubmissions: enrollmentCounts.get(`${assignment.academic_session_id}:${assignment.class_id}:${assignment.section_id}`) ?? 0,
      submissions: assignmentSubmissions.map((submission) => {
        const student = relation<{ first_name: string; middle_name?: string | null; last_name: string; student_identifier: string }>(submission.students);
        return {
          id: submission.id,
          studentId: submission.student_id,
          studentName: `${student?.first_name ?? ""} ${student?.middle_name ?? ""} ${student?.last_name ?? ""}`.trim(),
          studentIdentifier: student?.student_identifier ?? "Student",
          content: submission.content,
          status: submission.status,
          marks: submission.marks === null ? null : Number(submission.marks),
          feedback: submission.feedback,
          submittedAt: submission.submitted_at,
        };
      }),
    };
  });

  const today = new Date().toISOString().slice(0, 10);
  const sessionOptions = sessions ?? [];
  const defaultSessionId = sessionOptions.find((session) => session.is_current)?.id ?? sessionOptions[0]?.id ?? "";
  const teacherOptions = (teachers ?? []).map((teacher) => ({
    id: teacher.id,
    name: `${teacher.first_name} ${teacher.last_name}`.trim(),
  }));

  return <main className="students-shell assignments-shell">
    <AssignmentsWorkspace
      assignments={assignments}
      permissions={{ canManage, canSubmit: canSubmit && Boolean(studentRecord?.id), canReview }}
      currentStudentId={studentRecord?.id ?? ""}
      sessions={sessionOptions}
      defaultSessionId={defaultSessionId}
      classes={classes ?? []}
      sections={sections ?? []}
      subjects={subjects ?? []}
      teachers={teacherOptions}
      today={today}
    />
  </main>;
}
