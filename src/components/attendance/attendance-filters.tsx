"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ClassOption = { id: string; name: string };
type SectionOption = { id: string; name: string; class_id: string };

export function AttendanceFilters({
  date,
  selectedClassId,
  selectedSectionId,
  classes,
  sections,
}: {
  date: string;
  selectedClassId: string;
  selectedSectionId: string;
  classes: ClassOption[];
  sections: SectionOption[];
}) {
  const router = useRouter();
  const [classId, setClassId] = useState(selectedClassId);
  const classSections = classId ? sections.filter((section) => section.class_id === classId) : [];
  const selectedSectionStillAvailable = classSections.some((section) => section.id === selectedSectionId);
  const loadRoster = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const searchParams = new URLSearchParams();

    for (const name of ["date", "classId", "sectionId"]) {
      const value = formData.get(name);
      if (typeof value === "string" && value) searchParams.set(name, value);
    }

    const query = searchParams.toString();
    router.push(query ? `/attendance?${query}` : "/attendance", { scroll: false });
  };

  return <form className="attendance-filters" onSubmit={loadRoster}>
    <label>Date<input type="date" name="date" defaultValue={date} /></label>
    <label>Class<select
      name="classId"
      value={classId}
      onChange={(event) => setClassId(event.currentTarget.value)}
    >
      <option value="">Select class</option>
      {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    <label>Section<select
      key={classId}
      name="sectionId"
      defaultValue={selectedSectionStillAvailable ? selectedSectionId : ""}
      disabled={!classId || classSections.length === 0}
    >
      <option value="">{!classId ? "Select class first" : classSections.length ? "Select section" : "No active sections"}</option>
      {classSections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    <button type="submit">Load roster</button>
  </form>;
}
