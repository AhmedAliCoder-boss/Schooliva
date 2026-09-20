"use client";

import { useActionState, useState } from "react";

import { submitPeopleAttendance } from "@/app/actions/people-attendance";
import { SubmitButton } from "@/components/auth/submit-button";

type Person = { id: string; personType: "teacher" | "staff"; name: string; employeeCode: string; department?: string | null; status?: string };
const statuses = ["present", "absent", "late", "excused", "half_day"] as const;

export function PeopleAttendanceMarker({ attendanceDate, people }: { attendanceDate: string; people: Person[] }) {
  const [state, action] = useActionState(submitPeopleAttendance, undefined);
  const [records, setRecords] = useState(people.map((person) => ({ personId: person.id, personType: person.personType, status: (person.status ?? "present") as typeof statuses[number] })));
  const updateStatus = (personId: string, status: typeof statuses[number]) => setRecords((current) => current.map((record) => record.personId === personId ? { ...record, status } : record));
  const markAllPresent = () => setRecords((current) => current.map((record) => ({ ...record, status: "present" })));

  return <form action={action} className="attendance-marker"><input type="hidden" name="attendanceDate" value={attendanceDate} /><input type="hidden" name="records" value={JSON.stringify(records)} />{state?.error && <p className="student-error">{state.error}</p>}{state?.success && <p className="student-success">{state.success}</p>}<div className="attendance-toolbar"><span>{people.length} people in roster</span><button type="button" onClick={markAllPresent}>Mark all present</button></div><div className="attendance-table-wrap"><table className="student-table"><thead><tr><th>Person</th><th>Employee ID</th><th>Team</th><th>Status</th></tr></thead><tbody>{people.map((person) => { const record = records.find((item) => item.personId === person.id); return <tr key={`${person.personType}-${person.id}`}><td><strong>{person.name}</strong><small>{person.personType === "teacher" ? "Teacher" : "Staff"}</small></td><td>{person.employeeCode}</td><td>{person.department ?? "-"}</td><td><div className="attendance-statuses">{statuses.map((status) => <button className={record?.status === status ? `attendance-status active ${status}` : "attendance-status"} key={status} type="button" onClick={() => updateStatus(person.id, status)}>{status.replace("_", " ")}</button>)}</div></td></tr>; })}</tbody></table></div><SubmitButton>Submit people attendance</SubmitButton></form>;
}