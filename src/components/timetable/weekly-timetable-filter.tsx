"use client";

import { useState } from "react";

type Option = { id: string; name: string };
type SectionOption = Option & { class_id: string };

export function WeeklyTimetableFilter({
  classes,
  sections,
  sessions,
  selectedClassId,
  selectedSectionId,
  selectedSessionId,
}: {
  classes: Option[];
  sections: SectionOption[];
  sessions: Option[];
  selectedClassId: string;
  selectedSectionId: string;
  selectedSessionId: string;
}) {
  const [classId, setClassId] = useState(selectedClassId);
  const [sectionId, setSectionId] = useState(selectedSectionId);
  const classSections = sections.filter((section) => section.class_id === classId);

  return (
    <form action="/timetable" method="get" className="weekly-timetable-filter">
      <label className="student-field">Academic session
        <select name="sessionId" defaultValue={selectedSessionId} required>
          <option value="" disabled>Select academic session</option>
          {sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
        </select>
      </label>
      <label className="student-field">Class
        <select name="classId" value={classId} required onChange={(event) => {
          setClassId(event.target.value);
          setSectionId("");
        }}>
          <option value="" disabled>Select class</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="student-field">Section
        <select name="sectionId" value={classSections.some((section) => section.id === sectionId) ? sectionId : ""}
          required disabled={!classId || !classSections.length} onChange={(event) => setSectionId(event.target.value)}>
          <option value="" disabled>{classId ? "Select section" : "Select class first"}</option>
          {classSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
        </select>
      </label>
      <button className="admin-button" type="submit" disabled={!classId || !sectionId}>Load weekly schedule</button>
    </form>
  );
}
