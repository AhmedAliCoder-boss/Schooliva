"use client";

import { useActionState, useState } from "react";

import { submitAttendance } from "@/app/actions/attendance";
import { SubmitButton } from "@/components/auth/submit-button";

type Student = { id: string; enrollmentId: string; name: string; admissionNumber: string; status?: string; remarks?: string | null };
const statuses = ["present", "absent", "late", "excused", "half_day"] as const;

export function AttendanceMarker({ attendanceDate, classId, sectionId, students }: { attendanceDate: string; classId: string; sectionId: string; students: Student[] }) {
  const [state, action] = useActionState(submitAttendance, undefined); const [records, setRecords] = useState(students.map((student) => ({ studentId: student.id, enrollmentId: student.enrollmentId, status: (student.status ?? "present") as typeof statuses[number], remarks: student.remarks ?? "" })));
  const updateStatus = (studentId: string, status: typeof statuses[number]) => setRecords((current) => current.map((record) => record.studentId === studentId ? { ...record, status } : record));
  const markAllPresent = () => setRecords((current) => current.map((record) => ({ ...record, status: "present" })));
  return <form action={action} className="attendance-marker"><input type="hidden" name="attendanceDate" value={attendanceDate} /><input type="hidden" name="classId" value={classId} /><input type="hidden" name="sectionId" value={sectionId} /><input type="hidden" name="records" value={JSON.stringify(records)} />{state?.error && <p className="student-error">{state.error}</p>}{state?.success && <p className="student-success">{state.success}</p>}<div className="attendance-toolbar"><span>{students.length} enrolled students</span><button type="button" onClick={markAllPresent}>Mark all present</button></div><div className="attendance-table-wrap"><table className="student-table"><thead><tr><th>Student</th><th>Admission</th><th>Status</th></tr></thead><tbody>{students.map((student) => { const record = records.find((item) => item.studentId === student.id); return <tr key={student.id}><td><strong>{student.name}</strong></td><td>{student.admissionNumber}</td><td><div className="attendance-statuses">{statuses.map((status) => <button className={record?.status === status ? `attendance-status active ${status}` : `attendance-status`} key={status} type="button" onClick={() => updateStatus(student.id, status)}>{status.replace("_", " ")}</button>)}</div></td></tr>; })}</tbody></table></div><SubmitButton>Submit attendance</SubmitButton></form>;
}