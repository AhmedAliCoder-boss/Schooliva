import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteTimetableEntry } from "@/components/timetable/delete-entry";
import { TimetablePeriodsForm } from "@/components/timetable/periods-form";
import { TimetableForm } from "@/components/timetable/timetable-form";
import { WeeklyTimetableFilter } from "@/components/timetable/weekly-timetable-filter";
import { TimetableWorkingDaysForm } from "@/components/timetable/working-days-form";
import { requireTimetableContext } from "@/lib/timetable/context";
import { weeklyTimetableSelectionSchema } from "@/lib/timetable/schemas";
import { defaultTimetableWorkingDays, timetableDays } from "@/lib/timetable/working-days";

function relation<T>(value: unknown): T | null {
  return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null;
}

function time(value: unknown) {
  return typeof value === "string" ? value.slice(0, 5) : "--:--";
}

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string; edit?: string; classId?: string; sectionId?: string }>;
}) {
  const { supabase, schoolId } = await requireTimetableContext("view");
  const params = await searchParams;
  const { data: canManage, error: managePermissionError } = await supabase.rpc("has_permission", {
    target_school_id: schoolId,
    target_resource: "timetable",
    target_action: "manage",
  });
  if (managePermissionError) {
    console.error("Could not verify timetable management permissions.", managePermissionError);
  }
  const { data: sessions, error: sessionsError } = await supabase.from("academic_sessions")
    .select("id,name").eq("school_id", schoolId).order("starts_on", { ascending: false });
  if (sessionsError) {
    return <main className="timetable-shell"><p className="auth-error">Academic sessions could not be loaded. Refresh and try again.</p></main>;
  }
  const sessionRows = sessions ?? [];
  const selectedSession = sessionRows.find((session) => session.id === params.sessionId) ?? sessionRows[0] ?? null;
  const selection = weeklyTimetableSelectionSchema.safeParse({
    sessionId: params.sessionId,
    classId: params.classId,
    sectionId: params.sectionId,
  });
  const editingId = params.edit;
  if (editingId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(editingId)) notFound();

  const [
    { data: classes, error: classesError },
    { data: sections, error: sectionsError },
    { data: subjects, error: subjectsError },
    { data: teachers, error: teachersError },
    { data: classSubjects, error: classSubjectsError },
    { data: teacherAssignments, error: teacherAssignmentsError },
    { data: periods, error: periodsError },
    { data: schoolSettings, error: settingsError },
  ] = await Promise.all([
    supabase.from("classes").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("sections").select("id,name,class_id").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("subjects").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("teachers").select("id,first_name,last_name,employment_status")
      .eq("school_id", schoolId).eq("employment_status", "active").eq("is_active", true).is("deleted_at", null).order("last_name"),
    supabase.from("class_subjects").select("class_id,subject_id").eq("school_id", schoolId),
    selectedSession
      ? supabase.from("teacher_assignments").select("teacher_id,academic_session_id,subject_id,class_id")
        .eq("school_id", schoolId).eq("assignment_type", "subject")
        .eq("academic_session_id", selectedSession.id)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("timetable_periods").select("period_number,name,starts_at,ends_at")
      .eq("school_id", schoolId).eq("is_active", true).order("period_number"),
    supabase.from("school_settings").select("timetable_working_days").eq("school_id", schoolId).maybeSingle(),
  ]);
  if (classesError || sectionsError || subjectsError || teachersError || classSubjectsError || teacherAssignmentsError || periodsError || settingsError) {
    console.error("Timetable page data could not be loaded.", classesError ?? sectionsError ?? subjectsError ?? teachersError ?? classSubjectsError ?? teacherAssignmentsError ?? periodsError ?? settingsError);
    return <main className="timetable-shell"><p className="auth-error">Timetable data could not be loaded. Check your school setup and refresh the page.</p></main>;
  }
  const workingDays: number[] = schoolSettings?.timetable_working_days ?? defaultTimetableWorkingDays;

  const classRows = classes ?? [];
  const sectionRows = sections ?? [];
  const selectedClass = selection.success ? classRows.find((item) => item.id === selection.data.classId) ?? null : null;
  const selectedSection = selection.success ? sectionRows.find((item) =>
    item.id === selection.data.sectionId && item.class_id === selectedClass?.id
  ) ?? null : null;
  const hasWeeklySelection = Boolean(selection.success && selectedSession?.id === selection.data.sessionId && selectedClass && selectedSection);
  const { data: entries, error: entriesError } = hasWeeklySelection
    ? await supabase.from("timetable_entries")
      .select("id,academic_session_id,day_of_week,period_number,starts_at,ends_at,room,status,class_id,section_id,subject_id,teacher_id,subjects(name),sections(name),teachers(first_name,last_name)")
      .eq("school_id", schoolId).eq("academic_session_id", selectedSession!.id)
      .eq("class_id", selectedClass!.id).eq("section_id", selectedSection!.id)
      .eq("status", "active").order("day_of_week").order("period_number").order("starts_at")
    : { data: [], error: null };
  if (entriesError) {
    console.error("Selected class weekly timetable could not be loaded.", entriesError);
    return <main className="timetable-shell"><p className="auth-error">The selected class timetable could not be loaded. Refresh and try again.</p></main>;
  }

  let editingEntry: Record<string, unknown> | null = null;
  if (editingId) {
    const { data, error } = await supabase.from("timetable_entries")
      .select("id,academic_session_id,class_id,section_id,subject_id,teacher_id,day_of_week,period_number,starts_at,ends_at,room,status")
      .eq("id", editingId).eq("school_id", schoolId).maybeSingle();
    if (error) {
      console.error("Timetable entry could not be loaded for editing.", error);
      return <main className="timetable-shell"><p className="auth-error">This timetable entry could not be loaded for editing.</p></main>;
    }
    if (!data) notFound();
    editingEntry = data as Record<string, unknown>;
  }

  const rows = entries ?? [];
  const formSessions = sessionRows.map(({ id, name }) => ({ id, name }));
  const formClasses = (classes ?? []).map(({ id, name }) => ({ id, name }));
  const formSections = (sections ?? []).map(({ id, name, class_id }) => ({ id, name, class_id }));
  const formSubjects = (subjects ?? []).map(({ id, name }) => ({ id, name }));
  const formTeachers = (teachers ?? []).map(({ id, first_name, last_name, employment_status }) => ({
    id,
    name: `${[first_name, last_name].filter(Boolean).join(" ") || "Unnamed teacher"}${employment_status === "active" ? "" : ` · ${String(employment_status).replaceAll("_", " ")}`}`,
  }));
  const periodNames = new Map((periods ?? []).map((period) => [period.period_number, period.name]));
  const initialValues = editingEntry ? {
    id: String(editingEntry.id),
    academicSessionId: String(editingEntry.academic_session_id),
    classId: String(editingEntry.class_id),
    sectionId: String(editingEntry.section_id),
    subjectId: String(editingEntry.subject_id),
    teacherId: String(editingEntry.teacher_id),
    periodNumber: editingEntry.period_number ? Number(editingEntry.period_number) : undefined,
    dayOfWeek: Number(editingEntry.day_of_week),
    room: typeof editingEntry.room === "string" ? editingEntry.room : "",
    status: editingEntry.status as "active" | "inactive" | "archived",
  } : undefined;
  return (
    <main className="timetable-shell">
      <header className="students-header timetable-header">
        <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
        <nav aria-label="Timetable views">
          <Link className="text-action" href="/timetable">Weekly</Link>
          <Link className="text-action" href={`/timetable/class${selectedSession ? `?sessionId=${selectedSession.id}` : ""}`}>By class</Link>
          <Link className="text-action" href={`/timetable/teacher${selectedSession ? `?sessionId=${selectedSession.id}` : ""}`}>By teacher</Link>
          <Link className="text-action" href="/exams/timetable">Exam timetable</Link>
          <Link className="text-action" href="/dashboard">Dashboard</Link>
        </nav>
      </header>

      <section className="students-heading timetable-heading">
        <div><p className="eyebrow">Academic planning</p><h1>School timetable</h1><p>Configure the daily lesson periods and schedules for each class and section.</p></div>
        {hasWeeklySelection && <div className="timetable-heading__summary"><strong>{rows.length}</strong><span>lessons this week</span></div>}
      </section>

      {canManage === true
        ? <>
          <section id="periods" className="setup-card timetable-builder">
            <div className="timetable-section-heading">
              <div><p className="eyebrow">School schedule setup</p><h2>Daily class periods</h2></div>
              <span>Choose the number, names, and times used for every class.</span>
            </div>
            <TimetablePeriodsForm periods={periods ?? []} />
          </section>
          <section id="working-days" className="setup-card timetable-builder">
            <div className="timetable-section-heading">
              <div><p className="eyebrow">School schedule setup</p><h2>Working days</h2></div>
              <span>Set the days this school is open each week.</span>
            </div>
            <TimetableWorkingDaysForm workingDays={workingDays} />
          </section>
          <details id="builder" className="setup-card timetable-builder timetable-lesson-drawer" open={Boolean(editingEntry)}>
            <summary className="timetable-periods-drawer__summary">
              <span className="timetable-periods-drawer__icon" aria-hidden="true">{editingEntry ? "✎" : "+"}</span>
              <span className="timetable-periods-drawer__title">
                <strong>{editingEntry ? "Edit timetable entry" : "Add class lesson"}</strong>
                <small>{editingEntry ? "Update this lesson’s schedule details." : "Assign a subject to a daily period. Scheduling conflicts are checked."}</small>
              </span>
              <span className="timetable-periods-drawer__toggle">{editingEntry ? "Edit lesson" : "Add lesson"} <span aria-hidden="true">⌄</span></span>
            </summary>
            <div className="timetable-lesson-drawer__content">
              {!sessionRows.length
                ? <p className="timetable-prerequisite">Create an academic session before adding timetable entries.</p>
                : <TimetableForm
                    key={String(editingEntry?.id ?? "new")}
                    sessions={formSessions}
                    classes={formClasses}
                    sections={formSections}
                    subjects={formSubjects}
                    teachers={formTeachers}
                    classSubjects={classSubjects ?? []}
                    teacherAssignments={teacherAssignments ?? []}
                    periods={periods ?? []}
                    workingDays={workingDays}
                    initialValues={initialValues ?? {
                      academicSessionId: selectedSession?.id,
                      status: "active",
                    }}
                  />}
            </div>
          </details>
          </>
        : <p className="timetable-data-note">You have view-only access to this timetable.</p>}

      <section className="timetable-schedule-panel" aria-labelledby="weekly-schedule-title">
        <div className="timetable-toolbar">
          <div>
            <p className="eyebrow">Weekly overview</p>
            <h2 id="weekly-schedule-title">Load a class schedule</h2>
            <p className="timetable-toolbar__description">Choose a session, class, and section to view its full weekly schedule.</p>
          </div>
        </div>
        <WeeklyTimetableFilter
          classes={formClasses}
          sections={formSections}
          sessions={formSessions}
          selectedClassId={selectedClass?.id ?? ""}
          selectedSectionId={selectedSection?.id ?? ""}
          selectedSessionId={selectedSession?.id ?? ""}
        />
        {hasWeeklySelection && <div className="weekly-timetable-result-heading">
          <div><strong>{selectedClass!.name} · {selectedSection!.name}</strong><span>{selectedSession!.name} · {rows.length} scheduled lessons</span></div>
          <Link className="admin-button no-print" href={`/timetable/print?classId=${selectedClass!.id}&sectionId=${selectedSection!.id}&sessionId=${selectedSession!.id}`}>Print weekly schedule</Link>
        </div>}
        {!hasWeeklySelection
          ? <div className="timetable-empty"><h3>Choose a class and section</h3><p>Select the academic session, class, and section, then load the weekly schedule.</p></div>
          : rows.length ? <div className="timetable-days-grid">
          {timetableDays.filter(({ day }) => workingDays.includes(day)).map(({ day, name }) => {
            const dayRows = rows.filter((row) => row.day_of_week === day);
            return (
              <section className="timetable-day-card" key={day}>
                <header className="timetable-day-card__header">
                  <span className="timetable-day-card__index">{String(day).padStart(2, "0")}</span>
                  <h3>{name}</h3>
                  <span className="timetable-day-card__count">{dayRows.length} {dayRows.length === 1 ? "lesson" : "lessons"}</span>
                </header>
                <div className="timetable-day-card__lessons">
                {dayRows.map((row) => {
                  const subject = relation<{ name: string }>(row.subjects);
                  const teacher = relation<{ first_name: string; last_name?: string }>(row.teachers);
                  const entryId = String(row.id);
                  const editHref = `/timetable?sessionId=${row.academic_session_id}&classId=${selectedClass!.id}&sectionId=${selectedSection!.id}&edit=${entryId}#builder`;
                  return (
                    <article className="timetable-lesson-card" key={entryId}>
                      <div className="timetable-lesson-card__time">
                        <span>{row.period_number ? periodNames.get(row.period_number) ?? `Period ${row.period_number}` : "Class"}</span>
                        <time>{time(row.starts_at)} – {time(row.ends_at)}</time>
                      </div>
                      <h4>{subject?.name ?? "Subject unavailable"}</h4>
                      <p>{[teacher?.first_name, teacher?.last_name].filter(Boolean).join(" ") || "Teacher unavailable"}</p>
                      {row.room && <span className="timetable-lesson-card__room">Room {String(row.room)}</span>}
                      {canManage === true && <div className="timetable-lesson-card__actions">
                          <Link href={editHref}>Edit</Link>
                          <DeleteTimetableEntry id={entryId} />
                        </div>}
                    </article>
                  );
                })}
                {!dayRows.length && <p className="timetable-day-card__empty">No lessons scheduled</p>}
                </div>
              </section>
            );
          })}
          </div> : null}
        {hasWeeklySelection && !rows.length && (
          <div className="timetable-empty">
            <h3>No lessons scheduled for this section</h3>
            <p>Add lessons for this class and section above to build its weekly schedule.</p>
          </div>
        )}
      </section>
    </main>
  );
}
