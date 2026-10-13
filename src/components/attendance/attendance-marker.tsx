"use client";

import { useActionState, useState } from "react";

import { submitAttendance } from "@/app/actions/attendance";
import { SubmitButton } from "@/components/auth/submit-button";

type Student = {
  id: string;
  enrollmentId: string;
  name: string;
  studentIdentifier: string;
  admissionNumber: string;
  phone: string;
  rollNumber: string;
  status?: string;
  remarks?: string | null;
};
const statuses = ["present", "absent", "late", "excused", "half_day"] as const;

export function AttendanceMarker({
  attendanceDate,
  classId,
  className,
  sectionId,
  sectionName,
  students,
}: {
  attendanceDate: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  students: Student[];
}) {
  const [state, action] = useActionState(submitAttendance, undefined); const [records, setRecords] = useState(students.map((student) => ({ studentId: student.id, enrollmentId: student.enrollmentId, status: (student.status ?? "present") as typeof statuses[number], remarks: student.remarks ?? "" })));
  const updateStatus = (studentId: string, status: typeof statuses[number]) => setRecords((current) => current.map((record) => record.studentId === studentId ? { ...record, status } : record));
  const markAllPresent = () => setRecords((current) => current.map((record) => ({ ...record, status: "present" })));
  return <form action={action} className="attendance-marker">
    <input type="hidden" name="attendanceDate" value={attendanceDate} />
    <input type="hidden" name="classId" value={classId} />
    <input type="hidden" name="sectionId" value={sectionId} />
    <input type="hidden" name="records" value={JSON.stringify(records)} />
    {state?.error && <p className="student-error">{state.error}</p>}
    {state?.success && <p className="student-success">{state.success}</p>}
    <div className="attendance-toolbar">
      <span>{students.length} enrolled students</span>
      <div className="attendance-roster-context">
        <span>Class: {className}</span>
        <span>Section: {sectionName}</span>
      </div>
      <button type="button" onClick={markAllPresent}>Mark all present</button>
    </div>
    <div className="attendance-table-wrap">
      <table className="student-table attendance-roster-table">
        <thead><tr><th>Student</th><th>Admission &amp; roll</th><th>Status</th></tr></thead>
        <tbody>{students.map((student) => {
          const record = records.find((item) => item.studentId === student.id);
          return <tr key={student.id}>
            <td>
              <strong>{student.name}</strong>
              {student.studentIdentifier && <small className="attendance-student-detail">Student ID: {student.studentIdentifier}</small>}
              {student.phone && <a className="attendance-student-detail attendance-student-phone" href={`tel:${student.phone}`}>{student.phone}</a>}
            </td>
            <td>
              <strong>{student.admissionNumber || "-"}</strong>
              {student.rollNumber && <small className="attendance-student-detail">Roll no. {student.rollNumber}</small>}
            </td>
            <td><div className="attendance-statuses">{statuses.map((status) => <button className={record?.status === status ? `attendance-status active ${status}` : "attendance-status"} key={status} type="button" onClick={() => updateStatus(student.id, status)}>{status.replace("_", " ")}</button>)}</div></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <SubmitButton>Submit attendance</SubmitButton>
  </form>;
}