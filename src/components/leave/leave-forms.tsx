"use client";

import { useActionState, useState } from "react";

import { createLeaveRequest, decideLeave, saveLeaveType } from "@/app/actions/leave";
import { SubmitButton } from "@/components/auth/submit-button";
import type { LeaveFormState } from "@/lib/leave/schemas";

type Option = { id: string; name: string };

function Feedback({ state }: { state: LeaveFormState | undefined }) {
  return <>{state?.error && <p className="student-error">{state.error}</p>}{state?.success && <p className="student-success">{state.success}</p>}</>;
}

function Select({ label, name, options }: { label: string; name: string; options: Option[] }) {
  return <label className="student-field">{label}<select name={name} required><option value="">Select {label.toLowerCase()}</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}

export function LeaveTypeForm() {
  const [state, action] = useActionState(saveLeaveType, undefined);
  return <form action={action} className="student-form">
    <Feedback state={state} />
    <div className="student-form-grid">
      <label className="student-field">Leave type<input name="name" required maxLength={80} /></label>
      <label className="student-field student-field-wide">Description<textarea name="description" rows={3} maxLength={500} /></label>
    </div>
    <SubmitButton>Add leave type</SubmitButton>
  </form>;
}

export function LeaveRequestForm({ types, students, teachers, staff }: { types: Option[]; students: Option[]; teachers: Option[]; staff: Option[] }) {
  const [state, action] = useActionState(createLeaveRequest, undefined);
  const [subject, setSubject] = useState("");
  const [personSearch, setPersonSearch] = useState("");
  const [personOptionsOpen, setPersonOptionsOpen] = useState(false);
  const subjects = [
    ...students.map((item) => ({ ...item, type: "student" as const })),
    ...teachers.map((item) => ({ ...item, type: "teacher" as const })),
    ...staff.map((item) => ({ ...item, type: "staff" as const })),
  ];
  const matchingSubjects = subjects.filter((person) => person.name.toLocaleLowerCase().includes(personSearch.trim().toLocaleLowerCase()));
  const visibleSubjects = matchingSubjects.slice(0, 50);
  const [subjectType, subjectId] = subject ? subject.split(":", 2) : ["", ""];
  return <form action={action} className="student-form">
    <Feedback state={state} />
    <div className="student-form-grid">
      <Select label="Leave type" name="leaveTypeId" options={types} />
      <input type="hidden" name="subjectType" value={subjectType} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <div className="student-field student-field-wide leave-person-picker"><span>Person</span>
        <input
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={personOptionsOpen}
          aria-controls="leave-person-options"
          autoComplete="off"
          placeholder="Search name, student ID, or employee ID"
          value={personSearch}
          required
          onFocus={() => setPersonOptionsOpen(true)}
          onChange={(event) => {
            setPersonSearch(event.target.value);
            setSubject("");
            setPersonOptionsOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setPersonOptionsOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setPersonOptionsOpen(false);
            if (event.key === "ArrowDown") setPersonOptionsOpen(true);
            if (event.key === "Enter" && personOptionsOpen && visibleSubjects.length) {
              event.preventDefault();
              const first = visibleSubjects[0];
              setSubject(`${first.type}:${first.id}`);
              setPersonSearch(first.name);
              setPersonOptionsOpen(false);
            }
          }}
        />
        {personOptionsOpen && <div className="leave-person-picker__options" id="leave-person-options" role="listbox" aria-label="People">
          {visibleSubjects.length ? visibleSubjects.map((person) => <button
            type="button"
            role="option"
            aria-selected={subject === `${person.type}:${person.id}`}
            key={`${person.type}-${person.id}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setSubject(`${person.type}:${person.id}`);
              setPersonSearch(person.name);
              setPersonOptionsOpen(false);
            }}
          ><span>{person.name}</span><small>{person.type}</small></button>) : <p>No matching people found.</p>}
          {matchingSubjects.length > 50 && <small className="leave-person-picker__limit">Refine the search to see more matches.</small>}
        </div>}
      </div>
      <label className="student-field">Start date<input name="startDate" type="date" required /></label>
      <label className="student-field">End date<input name="endDate" type="date" required /></label>
      <label className="student-field student-field-wide">Reason<textarea name="reason" rows={4} required maxLength={2000} /></label>
      <label className="student-field student-field-wide">Upload supporting document (optional)
        <input name="document" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" />
        <small className="leave-upload-hint">PDF, JPG, or PNG · up to 5 MB</small>
      </label>
      <label className="student-field student-field-wide">Or use an existing private attachment path (optional)
        <input name="attachmentPath" placeholder="School ID / your account ID / file name" />
      </label>
    </div>
    <p className="student-form-note">Only the selected person type is used. Upload a document here or provide an existing path from your school/account folder; do not fill both.</p>
    <SubmitButton>Submit leave request</SubmitButton>
  </form>;
}

export function LeaveDecisionForm({ id }: { id: string }) {
  const [state, action] = useActionState(decideLeave, undefined);
  return <form action={action} className="leave-decision-form">
    <Feedback state={state} />
    <input type="hidden" name="leaveRequestId" value={id} />
    <label className="student-field">Decision<select name="status"><option value="approved">Approve</option><option value="rejected">Reject</option><option value="completed">Complete</option></select></label>
    <label className="student-field">Approver note<textarea name="approverNote" rows={2} maxLength={1000} /></label>
    <SubmitButton>Save decision</SubmitButton>
  </form>;
}
