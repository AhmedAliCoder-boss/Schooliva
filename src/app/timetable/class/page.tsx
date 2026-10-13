import Link from "next/link";

import { TimetableSessionFilter } from "@/components/timetable/session-filter";
import { requireTimetableContext } from "@/lib/timetable/context";

function relation<T>(value: unknown): T | null {
  return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null;
}

const days = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function ClassTimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string }>;
}) {
  const { supabase, schoolId } = await requireTimetableContext("view");
  const params = await searchParams;
  const { data: sessions, error: sessionsError } = await supabase.from("academic_sessions")
    .select("id,name").eq("school_id", schoolId).order("starts_on", { ascending: false });
  if (sessionsError) {
    return <main className="timetable-shell"><p className="auth-error">Academic sessions could not be loaded. Refresh and try again.</p></main>;
  }
  const sessionRows = sessions ?? [];
  const selectedSession = sessionRows.find((session) => session.id === params.sessionId) ?? sessionRows[0] ?? null;
  const showAllSessions = params.sessionId === "all";
  const { data: periodRows, error: periodsError } = await supabase.from("timetable_periods")
    .select("period_number,name").eq("school_id", schoolId).eq("is_active", true);
  if (periodsError) {
    console.error("Class timetable periods could not be loaded.", periodsError);
    return <main className="timetable-shell"><p className="auth-error">Class timetable periods could not be loaded. Refresh and try again.</p></main>;
  }
  const periodNames = new Map((periodRows ?? []).map((period) => [period.period_number, period.name]));
  let query = supabase.from("timetable_entries")
    .select("id,academic_session_id,day_of_week,period_number,starts_at,ends_at,room,subjects(name),classes(name),sections(name),teachers(first_name,last_name),academic_sessions(name)")
    .eq("school_id", schoolId).eq("status", "active");
  if (!showAllSessions && selectedSession) query = query.eq("academic_session_id", selectedSession.id);
  const { data: entries, error } = await query.order("class_id").order("day_of_week").order("period_number").order("starts_at");
  if (error) {
    console.error("Class timetable could not be loaded.", error);
    return <main className="timetable-shell"><p className="auth-error">Class timetables could not be loaded. Refresh and try again.</p></main>;
  }

  return (
    <main className="timetable-shell">
      <header className="students-header timetable-header">
        <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
        <nav aria-label="Timetable views">
          <Link className="text-action" href="/timetable">Weekly</Link>
          <Link className="text-action" href="/timetable/class">By class</Link>
          <Link className="text-action" href={`/timetable/teacher${selectedSession ? `?sessionId=${selectedSession.id}` : ""}`}>By teacher</Link>
          <Link className="text-action" href="/dashboard">Dashboard</Link>
        </nav>
      </header>
      <section className="students-heading timetable-heading">
        <div><p className="eyebrow">Class timetable</p><h1>Class schedules</h1><p>Review each active lesson by class and section.</p></div>
        <div className="timetable-heading__summary"><strong>{entries?.length ?? 0}</strong><span>active lessons</span></div>
      </section>
      <section className="timetable-schedule-panel">
        <div className="timetable-toolbar">
          <div><p className="eyebrow">Schedule view</p><h2>Lessons by class</h2></div>
          <TimetableSessionFilter sessions={sessionRows} selectedSessionId={showAllSessions ? "all" : selectedSession?.id ?? ""} action="/timetable/class" />
        </div>
        <div className="setup-table-wrap timetable-table-wrap">
          <table className="student-table timetable-table">
            <thead><tr><th>Class / section</th><th>Day</th><th>Period</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th><th>Academic session</th></tr></thead>
            <tbody>
              {(entries ?? []).map((entry) => {
                const teacher = relation<{ first_name: string; last_name?: string }>(entry.teachers);
                const subject = relation<{ name: string }>(entry.subjects);
                const cls = relation<{ name: string }>(entry.classes);
                const section = relation<{ name: string }>(entry.sections);
                const session = relation<{ name: string }>(entry.academic_sessions);
                return <tr key={entry.id}>
                  <td><strong>{cls?.name ?? "Class unavailable"}</strong><small>{section?.name ?? "Section unavailable"}</small></td>
                  <td>{days[entry.day_of_week] ?? "Unknown day"}</td>
                  <td>{entry.period_number ? periodNames.get(entry.period_number) ?? `Period ${entry.period_number}` : "Legacy"}</td>
                  <td>{String(entry.starts_at).slice(0, 5)}–{String(entry.ends_at).slice(0, 5)}</td>
                  <td>{subject?.name ?? "Subject unavailable"}</td>
                  <td>{[teacher?.first_name, teacher?.last_name].filter(Boolean).join(" ") || "Teacher unavailable"}</td>
                  <td>{entry.room ?? "—"}</td>
                  <td>{session?.name ?? "Unknown session"}</td>
                </tr>;
              })}
              {!entries?.length && <tr><td colSpan={8}><div className="student-empty"><h3>No class lessons found</h3><p>Choose another academic session or add lessons in the weekly timetable.</p><Link className="admin-button" href="/timetable">Open timetable builder</Link></div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
