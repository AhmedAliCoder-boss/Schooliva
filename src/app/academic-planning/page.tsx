import Link from "next/link";

import { AcademicPlanningBoard, type AcademicPlanRow } from "@/components/curriculum/academic-planning-board";
import { requireCurriculumContext } from "@/lib/curriculum/context";

type SearchParams = Promise<{ session?: string; class?: string; archived?: string }>;

function relation<T>(value: unknown): T | null {
  return Array.isArray(value) ? ((value[0] ?? null) as T | null) : (value as T | null);
}

export default async function AcademicPlanningPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, schoolId } = await requireCurriculumContext("view");
  const [
    { data: sessions, error: sessionError },
    { data: classes, error: classError },
    { data: managePermission, error: permissionError },
  ] = await Promise.all([
    supabase.from("academic_sessions").select("id,name,starts_on,ends_on,is_current").eq("school_id", schoolId).order("starts_on", { ascending: false }),
    supabase.from("classes").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "curriculum", target_action: "manage" }),
  ]);
  if (sessionError || classError || permissionError) {
    console.error("Academic planning session or access context could not be loaded.", sessionError ?? classError ?? permissionError);
    throw new Error("Academic planning could not be loaded.");
  }

  const selectedSession = sessions?.find((session) => session.id === params.session)
    ?? sessions?.find((session) => session.is_current)
    ?? sessions?.[0];
  if (!selectedSession) {
    return <main className="academic-planning-shell">
      <header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/dashboard">Dashboard →</Link></header>
      <section className="academic-planning-empty"><span>01</span><div><p className="eyebrow">Academic planning</p><h1>Create an academic session first</h1><p>Planning uses your school’s session dates, terms, classes, and mapped subjects.</p><Link href="/setup">Open school setup <span aria-hidden="true">→</span></Link></div></section>
    </main>;
  }

  const [
    { data: terms, error: termError },
    { data: mappings, error: mappingError },
    { data: teacherRows, error: teacherError },
    { data: activeTeachers, error: activeTeacherError },
  ] = await Promise.all([
    supabase.from("academic_terms").select("id,name,starts_on,ends_on").eq("school_id", schoolId).eq("academic_session_id", selectedSession.id).order("starts_on"),
    supabase.from("curriculum_subject_assignments").select("id,class_id,subject_id,classes(name),subjects(name,code)").eq("school_id", schoolId).eq("academic_session_id", selectedSession.id).eq("status", "active").order("created_at"),
    supabase.from("teacher_assignments").select("teacher_id,class_id,subject_id").eq("school_id", schoolId).eq("academic_session_id", selectedSession.id).eq("assignment_type", "subject"),
    supabase.from("teachers").select("id,first_name,last_name").eq("school_id", schoolId).eq("employment_status", "active").eq("is_active", true).is("deleted_at", null).order("last_name"),
  ]);
  if (termError || mappingError || teacherError || activeTeacherError) {
    console.error("Academic planning curriculum, terms, or teacher assignments could not be loaded.", termError ?? mappingError ?? teacherError ?? activeTeacherError);
    throw new Error("Academic planning options could not be loaded.");
  }

  const classMap = new Map((classes ?? []).map((item) => [item.id, item.name]));
  const teacherMap = new Map((activeTeachers ?? []).map((teacher) => [teacher.id, `${teacher.first_name} ${teacher.last_name}`.trim()]));
  const teachersForMapping = (classId: string, subjectId: string) => (teacherRows ?? [])
    .filter((assignment) => assignment.subject_id === subjectId && (!assignment.class_id || assignment.class_id === classId) && teacherMap.has(assignment.teacher_id))
    .map((assignment) => {
      return { id: assignment.teacher_id, name: teacherMap.get(assignment.teacher_id) ?? "Assigned teacher" };
    })
    .filter((teacher, index, all) => all.findIndex((item) => item.id === teacher.id) === index);
  const curriculum = (mappings ?? []).map((mapping) => {
    const cls = relation<{ name: string }>(mapping.classes);
    const subject = relation<{ name: string; code: string }>(mapping.subjects);
    return {
      key: `${mapping.class_id}|${mapping.subject_id}`,
      classId: mapping.class_id,
      subjectId: mapping.subject_id,
      label: `${cls?.name ?? classMap.get(mapping.class_id) ?? "Class"} · ${subject?.name ?? "Subject"}${subject?.code ? ` (${subject.code})` : ""}`,
      teachers: teachersForMapping(mapping.class_id, mapping.subject_id),
    };
  });
  const validClasses = new Set(classes?.map((item) => item.id) ?? []);
  const classFilter = params.class && validClasses.has(params.class) ? params.class : "";
  let planQuery = supabase.from("academic_plan_units")
    .select("id,academic_session_id,term_id,class_id,subject_id,teacher_id,unit_number,title,learning_objectives,key_concepts,planned_lessons,completed_lessons,planned_start_date,planned_end_date,assessment_plan,learning_resources,teacher_reflection,status,classes(name),subjects(name),academic_terms(name),teachers(first_name,last_name)")
    .eq("school_id", schoolId)
    .eq("academic_session_id", selectedSession.id)
    .order("planned_start_date")
    .order("unit_number");
  if (classFilter) planQuery = planQuery.eq("class_id", classFilter);
  if (params.archived !== "true") planQuery = planQuery.neq("status", "archived");
  const { data: planRows, error: planError } = await planQuery;
  if (planError) {
    console.error("Academic unit plans could not be loaded.", planError);
    throw new Error("Academic plans could not be loaded. If this feature was just installed, apply its database migration and refresh.");
  }

  const plans: AcademicPlanRow[] = (planRows ?? []).map((plan) => {
    const cls = relation<{ name: string }>(plan.classes);
    const subject = relation<{ name: string }>(plan.subjects);
    const term = relation<{ name: string }>(plan.academic_terms);
    const teacher = relation<{ first_name: string; last_name: string }>(plan.teachers);
    return {
      id: plan.id,
      academicSessionId: plan.academic_session_id,
      termId: plan.term_id,
      classId: plan.class_id,
      subjectId: plan.subject_id,
      teacherId: plan.teacher_id,
      unitNumber: plan.unit_number,
      title: plan.title,
      learningObjectives: plan.learning_objectives,
      keyConcepts: plan.key_concepts ?? "",
      plannedLessons: plan.planned_lessons,
      completedLessons: plan.completed_lessons,
      plannedStartDate: plan.planned_start_date,
      plannedEndDate: plan.planned_end_date,
      assessmentPlan: plan.assessment_plan,
      learningResources: plan.learning_resources ?? "",
      teacherReflection: plan.teacher_reflection ?? "",
      status: plan.status,
      className: cls?.name ?? classMap.get(plan.class_id) ?? "Class",
      subjectName: subject?.name ?? "Subject",
      termName: term?.name ?? null,
      teacherName: teacher ? `${teacher.first_name} ${teacher.last_name}` : null,
    };
  });
  const canManage = Boolean(managePermission);

  return <main className="academic-planning-shell">
    <header className="students-header">
      <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
      <nav aria-label="Academic navigation"><Link className="text-action" href="/curriculum">Subjects &amp; Classes</Link><Link className="text-action" href="/timetable">Timetable</Link><Link className="text-action" href="/dashboard">Dashboard →</Link></nav>
    </header>
    <section className="academic-planning-hero">
      <div className="academic-planning-hero__copy">
        <p className="eyebrow">ACADEMICS / YEAR PLAN</p>
        <h1>Plan with purpose.<br /><span>Teach with clarity.</span></h1>
        <p>Build a session-wide teaching sequence, keep every unit anchored to the curriculum, and make progress visible as learning happens.</p>
        <div className="academic-planning-hero__meta"><span>{selectedSession.name}</span><i />{new Date(`${selectedSession.starts_on}T12:00:00`).toLocaleDateString("en", { month: "short", year: "numeric" })} – {new Date(`${selectedSession.ends_on}T12:00:00`).toLocaleDateString("en", { month: "short", year: "numeric" })}<i />{canManage ? "Planning access" : "View only"}</div>
      </div>
      <div className="academic-planning-hero__mark" aria-hidden="true"><span>01</span><span>PLAN</span><i /></div>
    </section>
    <section className="academic-planning-filters">
      <form method="get" id="academic-planning-filter">
        <label>Academic session
          <select name="session" defaultValue={selectedSession.id}>
          {(sessions ?? []).map((session) => <option value={session.id} key={session.id}>{session.name}{session.is_current ? " · Current" : ""}</option>)}
          </select>
        </label>
        <label>Class
          <select name="class" defaultValue={classFilter}>
            <option value="">All classes</option>
            {(classes ?? []).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </label>
        {params.archived === "true" && <input type="hidden" name="archived" value="true" />}
        <button className="academic-planning-filter-button" type="submit">View plan <span aria-hidden="true">→</span></button>
      </form>
      {params.archived === "true"
        ? <Link className="academic-planning-archived-link" href={`/academic-planning?session=${selectedSession.id}${classFilter ? `&class=${classFilter}` : ""}`}>Hide archived</Link>
        : <Link className="academic-planning-archived-link" href={`/academic-planning?session=${selectedSession.id}${classFilter ? `&class=${classFilter}` : ""}&archived=true`}>Show archived</Link>}
    </section>
    <AcademicPlanningBoard
      sessionId={selectedSession.id}
      terms={(terms ?? []).map((term) => ({ id: term.id, name: term.name }))}
      curriculum={curriculum}
      plans={plans}
      canManage={canManage}
    />
  </main>;
}
