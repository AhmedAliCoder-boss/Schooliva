"use client";

import { useActionState } from "react";

import { saveTimetableWorkingDays } from "@/app/actions/timetable";
import { SubmitButton } from "@/components/auth/submit-button";
import { defaultTimetableWorkingDays, timetableDays } from "@/lib/timetable/working-days";

export function TimetableWorkingDaysForm({ workingDays }: { workingDays: number[] }) {
  const [state, action] = useActionState(saveTimetableWorkingDays, undefined);
  const selectedDays = workingDays.length ? workingDays : defaultTimetableWorkingDays;
  const workingDayNames = timetableDays
    .filter(({ day }) => selectedDays.includes(day))
    .map(({ name }) => name);

  return (
    <details className="timetable-periods-drawer timetable-working-days-drawer">
      <summary className="timetable-periods-drawer__summary">
        <span className="timetable-periods-drawer__icon" aria-hidden="true">▦</span>
        <span className="timetable-periods-drawer__title">
          <strong>School working days</strong>
          <small>{workingDayNames.length === 7 ? "All seven days are working days" : workingDayNames.join(" · ")}</small>
        </span>
        <span className="timetable-periods-drawer__toggle">Set working days <span aria-hidden="true">⌄</span></span>
      </summary>
      <form action={action} className="timetable-working-days-form">
        {state?.error && <p className="student-error" role="status">{state.error}</p>}
        {state?.success && <p className="student-success" role="status">{state.success}</p>}
        <p className="student-muted">Select each day the school is open. Unselected days are treated as school holidays and are hidden from weekly schedules.</p>
        <fieldset className="timetable-working-days-list">
          <legend>Days the school is open</legend>
          {timetableDays.map(({ day, name, shortName }) => (
            <label className="timetable-working-day" key={day}>
              <input type="checkbox" name="workingDay" value={day} defaultChecked={selectedDays.includes(day)} />
              <span className="timetable-working-day__short">{shortName}</span>
              <span className="timetable-working-day__name">{name}</span>
            </label>
          ))}
        </fieldset>
        <div className="timetable-working-days-form__footer">
          <span>At least one working day must be selected.</span>
          <SubmitButton>Save working days</SubmitButton>
        </div>
      </form>
    </details>
  );
}
