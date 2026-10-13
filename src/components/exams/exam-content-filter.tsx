"use client";

import Link from "next/link";
import { useState } from "react";

type ClassOption = { id: string; name: string };
type SectionOption = { id: string; name: string; class_id: string };

export function ExamContentFilter({
  examId,
  classes,
  sections,
  initialClassId,
  initialSectionId,
}: {
  examId: string;
  classes: ClassOption[];
  sections: SectionOption[];
  initialClassId: string;
  initialSectionId: string;
}) {
  const [classId, setClassId] = useState(initialClassId);
  const [sectionId, setSectionId] = useState(initialSectionId);
  const classSections = sections.filter((section) => section.class_id === classId);

  return (
    <form className="exam-content-filter" action={`/exams/${examId}`} method="get">
      <label className="student-field">Load class content
        <select name="classId" value={classId} onChange={(event) => {
          setClassId(event.target.value);
          setSectionId("");
        }}>
          <option value="">All classes</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="student-field">Section
        <select name="sectionId" value={sectionId} disabled={!classId} onChange={(event) => setSectionId(event.target.value)}>
          <option value="">All sections</option>
          {classSections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <button className="table-edit" type="submit">Load saved content</button>
      {(classId || sectionId) && <Link className="text-action" href={`/exams/${examId}`}>Show all</Link>}
    </form>
  );
}
