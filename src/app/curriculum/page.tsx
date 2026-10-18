import Link from "next/link";

import { CurriculumForm, TeacherSubjectForm } from "@/components/curriculum/curriculum-forms";
import { requireCurriculumContext } from "@/lib/curriculum/context";

type SearchParams = Promise<{ session?: string; class?: string }>;

function relation<T>(value: unknown): T | null {
  return Array.isArray(value) ? ((value[0] ?? null) as T | null) : (value as T | null);
}

export default async function CurriculumPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, schoolId } = await requireCurriculumContext("view");
  const [
    { data: sessions, error: sessionError },
    { data: classes, error: classError },
    { data: subjects, error: subjectError },
    { data: teachers, error: teachersError },
    { data: managePermission, error: permissionError },
  ] = await Promise.all([
    supabase.from("academic_sessions").select("id,name,starts_on,ends_on,is_current").eq("school_id", schoolId).order("starts_on", { ascending: false }),
    supabase.from("classes").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("subjects").select("id,name,code,subject_type,status").eq("school_id", schoolId).order("name"),
    supabase.from("teachers").select("id,first_name,last_name").eq("school_id", schoolId).eq("employment_status", "active").eq("is_active", true).is("deleted_at", null).order("last_name"),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "curriculum", target_action: "manage" }),
  ]);
  if (sessionError || classError || subjectError || teachersError || permissionError) {
    console.error("Curriculum workspace data could not be loaded.", sessionError ?? classError ?? subjectError ?? teachersError ?? permissionError);
    throw new Error("Subjects and classes could not be loaded.");
  }

  const sessionRows = sessions ?? [];
  const classRows = classes ?? [];
  const subjectRows = subjects ?? [];
  const teacherRows = teachers ?? [];
  const selectedSession = sessionRows.find((session) => session.id === params.session)
    ?? sessionRows.find((session) => session.is_current)
    ?? sessionRows[0];
  const validClassIds = new Set(classRows.map((item) => item.id));
  const selectedClass = params.class && validClassIds.has(params.class) ? params.class : "";
  const canManage = Boolean(managePermission);

  const [{ data: mappings, error: mappingsError }, { data: assignments, error: assignmentsError }] = selectedSession
    ? await Promise.all([
      (() => {
        let query = supabase.from("curriculum_subject_assignments")
          .select("id,academic_session_id,class_id,subject_id,credits,grading_weight,status,classes(name),subjects(name,code,subject_type)")
          .eq("school_id", schoolId)
          .eq("academic_session_id", selectedSession.id)
          .order("created_at", { ascending: false });
        if (selectedClass) query = query.eq("class_id", selectedClass);
        return query;
      })(),
      (() => {
        let query = supabase.from("teacher_assignments")
          .select("id,academic_session_id,teacher_id,class_id,subject_id,teachers(first_name,last_name),subjects(name,code),classes(name)")
          .eq("school_id", schoolId)
          .eq("academic_session_id", selectedSession.id)
          .eq("assignment_type", "subject")
          .order("created_at", { ascending: false });
        if (selectedClass) query = query.or(`class_id.is.null,class_id.eq.${selectedClass}`);
        return query;
      })(),
    ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (mappingsError || assignmentsError) {
    console.error("Session curriculum or teacher assignments could not be loaded.", mappingsError ?? assignmentsError);
    throw new Error("Curriculum mappings could not be loaded.");
  }

  const mappingRows = mappings ?? [];
  const assignmentRows = assignments ?? [];
  const mappedSubjectIds = new Set(mappingRows.filter((mapping) => mapping.status === "active").map((mapping) => mapping.subject_id));
  const activeSubjects = subjectRows.filter((subject) => subject.status === "active");
  const subjectOptions = activeSubjects.map(({ id, name }) => ({ id, name }));
  const classNames = new Map(classRows.map((item) => [item.id, item.name]));
  const teacherNames = new Map(teacherRows.map((teacher) => [teacher.id, `${teacher.first_name} ${teacher.last_name}`.trim()]));
  const unusedSubjectCount = activeSubjects.filter((subject) => !mappedSubjectIds.has(subject.id)).length;
  const currentStart = selectedSession ? new Date(`${selectedSession.starts_on}T12:00:00Z`).toLocaleDateString("en", { timeZone: "Asia/Karachi", month: "short", year: "numeric" }) : "";
  const currentEnd = selectedSession ? new Date(`${selectedSession.ends_on}T12:00:00Z`).toLocaleDateString("en", { timeZone: "Asia/Karachi", month: "short", year: "numeric" }) : "";

  return <main className="academic-planning-shell curriculum-shell">
    <header className="students-header">
      <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
      <nav aria-label="Academic navigation">
        <Link className="text-action" href="/academic-planning">Academic planning</Link>
        <Link className="text-action" href="/timetable">Timetable</Link>
        <Link className="text-action" href="/dashboard">Dashboard →</Link>
      </nav>
    </header>
    <section className="academic-planning-hero curriculum-hero">
      <div className="academic-planning-hero__copy">
        <p className="eyebrow">ACADEMICS / SUBJECT FRAMEWORK</p>
        <h1>Curriculum.<br /><span>Built to connect.</span></h1>
        <p>Organize what each class learns, align subject weight to the year, and connect the right teachers before planning begins.</p>
        <div className="academic-planning-hero__meta">
          <span>{selectedSession?.name ?? "No academic session"}</span>
          {selectedSession && <><i />{currentStart} – {currentEnd}</>}
          <i />{canManage ? "Curriculum access" : "View only"}
        </div>
      </div>
      <div className="academic-planning-hero__mark" aria-hidden="true"><span>02</span><span>CURRICULUM</span><i /></div>
    </section>
    <section className="academic-planning-filters curriculum-filters">
      <form method="get">
        <label>Academic session
          <select name="session" defaultValue={selectedSession?.id ?? ""} disabled={!sessionRows.length}>
            {sessionRows.map((session) => <option value={session.id} key={session.id}>{session.name}{session.is_current ? " · Current" : ""}</option>)}
          </select>
        </label>
        <label>Class
          <select name="class" defaultValue={selectedClass}>
            <option value="">All classes</option>
            {classRows.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </label>
        <button className="academic-planning-filter-button" type="submit">View curriculum <span aria-hidden="true">→</span></button>
      </form>
      <Link className="academic-planning-archived-link" href="/academic-planning">Continue to planning →</Link>
    </section>
    {!selectedSession ? (
      <section className="academic-planning-empty"><span>01</span><div><h3>Create an academic session first</h3><p>Curriculum mappings connect a class and subject to a school year. Create session dates before you start.</p><Link href="/setup">Open school setup <span aria-hidden="true">→</span></Link></div></section>
    ) : <>
      <section className="academic-planning-metrics curriculum-metrics" aria-label="Curriculum summary">
        <article><span>Class mappings</span><strong>{mappingRows.filter((item) => item.status === "active").length}</strong><small>Active in this session</small></article>
        <article><span>Subjects mapped</span><strong>{mappedSubjectIds.size}</strong><small>Of {activeSubjects.length} active subjects</small></article>
        <article className={unusedSubjectCount ? "is-warning" : ""}><span>Need class mapping</span><strong>{unusedSubjectCount}</strong><small>Active subjects not yet mapped</small></article>
        <article><span>Teacher assignments</span><strong>{assignmentRows.length}</strong><small>For the selected session</small></article>
      </section>
      <div className="academic-planning-toolbar curriculum-section-heading">
        <div><p className="eyebrow">SUBJECTS · CLASSES · TEACHERS</p><h2>Curriculum framework</h2><p>Start with subject-to-class mappings, then attach teachers to the relevant subjects.</p></div>
        {canManage && <details className="academic-planning-editor curriculum-add-menu">
          <summary>Add to curriculum <span aria-hidden="true">＋</span></summary>
          <div className="curriculum-add-menu__options">
            <a href="#map-subject">Map a subject <span aria-hidden="true">→</span></a>
            <a href="#assign-teacher">Assign a teacher <span aria-hidden="true">→</span></a>
          </div>
        </details>}
      </div>
      <section className="curriculum-workspaces">
        <div className="curriculum-workspace">
          <div className="curriculum-workspace__heading">
            <div><p className="eyebrow">01 / CLASS STRUCTURE</p><h2>Subjects by class</h2><p>Define session-specific credit and grading weight.</p></div>
            <span>{mappingRows.length} {mappingRows.length === 1 ? "mapping" : "mappings"}</span>
          </div>
          {canManage && <details className="academic-planning-editor curriculum-form-editor" id="map-subject">
            <summary>Map subject to class <span aria-hidden="true">＋</span></summary>
            <CurriculumForm sessions={sessionRows.map(({ id, name }) => ({ id, name }))} classes={classRows} subjects={subjectOptions} defaultSessionId={selectedSession.id} />
          </details>}
          {mappingRows.length ? <div className="curriculum-mapping-list">
            {mappingRows.map((item) => {
              const cls = relation<{ name: string }>(item.classes);
              const subject = relation<{ name: string; code: string; subject_type: string }>(item.subjects);
              const isActive = item.status === "active";
              return <article className="curriculum-mapping-card" key={item.id}>
                <div className="curriculum-mapping-card__icon" aria-hidden="true">{subject?.name?.slice(0, 1) ?? "S"}</div>
                <div className="curriculum-mapping-card__main">
                  <div className="curriculum-mapping-card__top"><span className={`academic-planning-status ${isActive ? "is-completed" : "is-archived"}`}>{item.status}</span><span className="curriculum-mapping-card__class">{cls?.name ?? classNames.get(item.class_id) ?? "Class"}</span></div>
                  <h3>{subject?.name ?? "Subject"}</h3>
                  <p>{subject?.code ?? "No code"}{subject?.subject_type ? ` · ${subject.subject_type.replaceAll("_", " ")}` : ""}</p>
                  <div className="curriculum-mapping-card__metrics">
                    <span><small>CREDITS</small><strong>{item.credits ?? "—"}</strong></span>
                    <span><small>GRADING WEIGHT</small><strong>{item.grading_weight != null ? `${item.grading_weight}%` : "Not set"}</strong></span>
                  </div>
                </div>
              </article>;
            })}
          </div> : <div className="curriculum-workspace__empty"><span>01</span><div><h3>No subject mappings yet</h3><p>Map an active subject to a class to include it in this session’s curriculum.</p></div></div>}
        </div>
        <div className="curriculum-workspace">
          <div className="curriculum-workspace__heading">
            <div><p className="eyebrow">02 / TEACHING TEAM</p><h2>Subject assignments</h2><p>Connect active subject teachers to the session and class.</p></div>
            <span>{assignmentRows.length} {assignmentRows.length === 1 ? "assignment" : "assignments"}</span>
          </div>
          {canManage && <details className="academic-planning-editor curriculum-form-editor" id="assign-teacher">
            <summary>Assign teacher to subject <span aria-hidden="true">＋</span></summary>
            <TeacherSubjectForm sessions={sessionRows.map(({ id, name }) => ({ id, name }))} teachers={teacherRows.map((teacher) => ({ id: teacher.id, name: `${teacher.first_name} ${teacher.last_name}`.trim() }))} subjects={subjectOptions} classes={classRows} defaultSessionId={selectedSession.id} defaultClassId={selectedClass} />
          </details>}
          {assignmentRows.length ? <div className="curriculum-assignment-list">
            {assignmentRows.map((item) => {
              const teacher = relation<{ first_name: string; last_name: string }>(item.teachers);
              const subject = relation<{ name: string; code: string }>(item.subjects);
              const cls = relation<{ name: string }>(item.classes);
              const teacherName = teacherNames.get(item.teacher_id) ?? (`${teacher?.first_name ?? ""} ${teacher?.last_name ?? ""}`.trim() || "Teacher");
              return <article className="curriculum-assignment-card" key={item.id}>
                <div className="curriculum-assignment-card__avatar">{teacherName.slice(0, 1) || "T"}</div>
                <div><strong>{teacherName}</strong><p>{subject?.name ?? "Subject"}{subject?.code ? ` · ${subject.code}` : ""}</p></div>
                <span>{cls?.name ?? classNames.get(item.class_id ?? "") ?? "All classes"}</span>
              </article>;
            })}
          </div> : <div className="curriculum-workspace__empty"><span>02</span><div><h3>No subject teachers assigned</h3><p>Assign an active teacher to help prepare a complete timetable and academic plan.</p></div></div>}
          <Link className="curriculum-workspace__next" href={`/academic-planning?session=${selectedSession.id}`}>Continue to academic planning <span aria-hidden="true">→</span></Link>
        </div>
      </section>
      {!canManage && <p className="academic-planning-readonly">You have view-only access. Contact a school administrator to change this curriculum.</p>}
    </>}
  </main>;
}
