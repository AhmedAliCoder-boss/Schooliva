import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintAction } from "@/components/print/print-action";
import { SchoolDocument } from "@/components/print/school-document";
import { getSchoolDocumentIdentity } from "@/lib/print/school-document";
import { requireTimetableContext } from "@/lib/timetable/context";
import { buildTimetableGridSlots, timetableGridSlotKey } from "@/lib/timetable/grid";
import { defaultTimetableWorkingDays, timetableDays } from "@/lib/timetable/working-days";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SearchParams = Promise<{ classId?: string; sectionId?: string; sessionId?: string }>;

export default async function TimetablePrintPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  if (!params.classId || !params.sectionId || !params.sessionId
    || !uuidPattern.test(params.classId) || !uuidPattern.test(params.sectionId) || !uuidPattern.test(params.sessionId)) {
    notFound();
  }

  const { supabase, schoolId } = await requireTimetableContext("view");
  const [
    { data: schoolClass, error: classError },
    { data: section, error: sectionError },
    { data: session, error: sessionError },
    { data: periods, error: periodsError },
    { data: schoolSettings, error: settingsError },
    school,
  ] = await Promise.all([
    supabase.from("classes").select("id,name").eq("school_id", schoolId).eq("id", params.classId).maybeSingle(),
    supabase.from("sections").select("id,name,class_id").eq("school_id", schoolId).eq("id", params.sectionId).maybeSingle(),
    supabase.from("academic_sessions").select("id,name").eq("school_id", schoolId).eq("id", params.sessionId).maybeSingle(),
    supabase.from("timetable_periods").select("period_number,name,starts_at,ends_at").eq("school_id", schoolId).eq("is_active", true).order("period_number"),
    supabase.from("school_settings").select("timetable_working_days").eq("school_id", schoolId).maybeSingle(),
    getSchoolDocumentIdentity(supabase, schoolId),
  ]);
  if (classError || sectionError || sessionError || periodsError || settingsError) {
    console.error("Weekly timetable print identity could not be loaded.", classError ?? sectionError ?? sessionError ?? periodsError ?? settingsError);
    throw new Error("Weekly timetable could not be prepared for printing.");
  }
  if (!schoolClass || !section || !session || section.class_id !== schoolClass.id) notFound();
  const workingDays: number[] = schoolSettings?.timetable_working_days ?? defaultTimetableWorkingDays;
  const days = timetableDays.filter(({ day }) => workingDays.includes(day));

  const { data: entries, error } = await supabase.from("timetable_entries")
    .select("id,day_of_week,period_number,starts_at,ends_at,room,subjects(name),teachers(first_name,last_name)")
    .eq("school_id", schoolId).eq("academic_session_id", session.id)
    .eq("class_id", schoolClass.id).eq("section_id", section.id)
    .eq("status", "active").order("day_of_week").order("period_number").order("starts_at");
  if (error) {
    console.error("Weekly timetable entries could not be loaded for printing.", error);
    throw new Error("Weekly timetable entries could not be loaded for printing.");
  }
  const slots = buildTimetableGridSlots(entries, periods ?? []);

  return (
    <main className="school-document-page timetable-print-page">
      <div className="school-document-toolbar no-print">
        <Link href={`/timetable?sessionId=${session.id}&classId=${schoolClass.id}&sectionId=${section.id}`}>Back to timetable</Link>
        <PrintAction label="Print weekly timetable / Save PDF" />
      </div>
      <SchoolDocument
        className="school-document--timetable"
        school={school}
        title="Weekly class timetable"
        reference={`${schoolClass.name} · ${section.name}`}
      >
        <div className="timetable-print-heading">
          <h2>{schoolClass.name} · {section.name}</h2>
          <p>Academic session: {session.name}</p>
        </div>
        {entries.length ? <div className="timetable-print-grid-wrap">
          <table className="timetable-print-grid">
            <thead><tr><th scope="col">Period</th>{days.map(({ name }) => <th scope="col" key={name}>{name}</th>)}</tr></thead>
            <tbody>{slots.map((slot) => <tr key={slot.key}>
              <th scope="row">
                <strong>{slot.name}</strong>
                <span>{slot.startsAt}–{slot.endsAt}</span>
              </th>
              {days.map(({ day }) => {
                const dayEntries = entries.filter((entry) =>
                  entry.day_of_week === day && timetableGridSlotKey(entry) === slot.key
                );
                return <td key={day}>
                  {dayEntries.length ? dayEntries.map((entry) => {
                    const subject = Array.isArray(entry.subjects) ? entry.subjects[0] : entry.subjects;
                    const teacher = Array.isArray(entry.teachers) ? entry.teachers[0] : entry.teachers;
                    return <div className="timetable-print-cell" key={entry.id}>
                      <strong>{subject?.name ?? "—"}</strong>
                      <span>{[teacher?.first_name, teacher?.last_name].filter(Boolean).join(" ") || "—"}</span>
                      {entry.room && <small>Room {entry.room}</small>}
                    </div>;
                  }) : <span className="timetable-print-empty">—</span>}
                </td>;
              })}
            </tr>)}</tbody>
          </table>
        </div> : <p className="student-muted">No lessons are scheduled for this section in the selected academic session.</p>}
      </SchoolDocument>
    </main>
  );
}
