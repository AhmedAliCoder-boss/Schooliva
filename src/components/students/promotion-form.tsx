"use client";

import { useActionState, useState } from "react";

import { promoteStudent } from "@/app/actions/promotions";
import { SubmitButton } from "@/components/auth/submit-button";

type Option = { id: string; name: string };
type SectionOption = Option & { class_id: string };

export function PromotionForm({
  studentId,
  sourceSessionId,
  targetSessionId,
  classes,
  sections,
}: {
  studentId: string;
  sourceSessionId: string;
  targetSessionId: string;
  classes: Option[];
  sections: SectionOption[];
}) {
  const [state, action] = useActionState(promoteStudent, undefined);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const availableSections = sections.filter((section) => section.class_id === classId);

  return (
    <form action={action} className="promotion-form">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="sourceSessionId" value={sourceSessionId} />
      <input type="hidden" name="targetSessionId" value={targetSessionId} />
      <label className="student-field">Promote to class
        <select name="classId" value={classId} onChange={(event) => { setClassId(event.target.value); setSectionId(""); }} required>
          <option value="">Select class</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="student-field">Section
        <select name="sectionId" value={sectionId} onChange={(event) => setSectionId(event.target.value)} required disabled={!classId}>
          <option value="">Select section</option>
          {availableSections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <SubmitButton>Promote student</SubmitButton>
      {state?.error && <p className="student-error">{state.error}</p>}
      {state?.success && <p className="student-success">{state.success}</p>}
    </form>
  );
}
