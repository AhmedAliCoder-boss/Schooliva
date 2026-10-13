"use client";

import { useActionState, useState } from "react";

import { saveTimetablePeriods } from "@/app/actions/timetable";
import { SubmitButton } from "@/components/auth/submit-button";

type Period = { name: string; starts_at: string; ends_at: string };

export function TimetablePeriodsForm({ periods }: { periods: Period[] }) {
  const [state, action] = useActionState(saveTimetablePeriods, undefined);
  const initialRows = periods.map((period) => ({
    name: period.name,
    starts_at: period.starts_at.slice(0, 5),
    ends_at: period.ends_at.slice(0, 5),
  }));
  const [rows, setRows] = useState<Period[]>(initialRows.length
    ? initialRows
    : [{ name: "Period 1", starts_at: "", ends_at: "" }]);
  const addPeriod = () => setRows((current) => current.length < 16
    ? [...current, { name: `Period ${current.length + 1}`, starts_at: "", ends_at: "" }]
    : current);
  const configuredRange = periods.length
    ? `${periods[0]!.starts_at.slice(0, 5)} – ${periods[periods.length - 1]!.ends_at.slice(0, 5)}`
    : "No periods configured yet";

  return (
    <details className="timetable-periods-drawer" open={!periods.length}>
      <summary className="timetable-periods-drawer__summary">
        <span className="timetable-periods-drawer__icon" aria-hidden="true">◷</span>
        <span className="timetable-periods-drawer__title">
          <strong>Daily period configuration</strong>
          <small>{periods.length} {periods.length === 1 ? "period" : "periods"} · {configuredRange}</small>
        </span>
        <span className="timetable-periods-drawer__toggle">Configure periods <span aria-hidden="true">⌄</span></span>
      </summary>
      <form action={action} className="student-form timetable-periods-form">
        {state?.error && <p className="student-error" role="status">{state.error}</p>}
        {state?.success && <p className="student-success" role="status">{state.success}</p>}
        <p className="student-muted">Set the school-wide daily periods. Each class lesson assigned to a period uses its configured time automatically.</p>
        <div className="timetable-period-list" aria-label="Daily periods">
          {rows.map((period, index) => (
            <fieldset className="timetable-period-row" key={index}>
              <legend className="timetable-period-row__number"><span>{String(index + 1).padStart(2, "0")}</span> Period {index + 1}</legend>
              <label className="student-field timetable-period-row__name">Period name
                <input name="periodName" value={period.name} maxLength={60} required
                  onChange={(event) => setRows((current) => current.map((row, rowIndex) =>
                    rowIndex === index ? { ...row, name: event.target.value } : row
                  ))} />
              </label>
              <label className="student-field">Starts at
                <input name="startsAt" type="time" value={period.starts_at} required
                  onChange={(event) => setRows((current) => current.map((row, rowIndex) =>
                    rowIndex === index ? { ...row, starts_at: event.target.value } : row
                  ))} />
              </label>
              <label className="student-field">Ends at
                <input name="endsAt" type="time" value={period.ends_at} required
                  onChange={(event) => setRows((current) => current.map((row, rowIndex) =>
                    rowIndex === index ? { ...row, ends_at: event.target.value } : row
                  ))} />
              </label>
              <button className="timetable-period-row__remove" type="button" aria-label={`Remove period ${index + 1}`}
                disabled={rows.length <= 1} onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>
                Remove
              </button>
            </fieldset>
          ))}
        </div>
        <div className="timetable-periods-form__footer">
          <div className="timetable-periods-form__actions">
            <button className="text-action" type="button" onClick={addPeriod} disabled={rows.length >= 16}>
              <span aria-hidden="true">+</span> Add period
            </button>
            <span>{rows.length} of 16 periods</span>
          </div>
          <SubmitButton>Save period configuration</SubmitButton>
        </div>
      </form>
    </details>
  );
}
