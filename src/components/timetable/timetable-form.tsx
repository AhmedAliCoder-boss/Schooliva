"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { saveTimetableEntry } from "@/app/actions/timetable";
import { SubmitButton } from "@/components/auth/submit-button";
import type { TimetableFormState } from "@/lib/timetable/schemas";
import { getAssignedTeacherIds, type TeacherSubjectAssignment } from "@/lib/academics/teacher-assignments";
import { defaultTimetableWorkingDays, timetableDays } from "@/lib/timetable/working-days";

type Option = { id: string; name: string };
type SectionOption = Option & { class_id: string };
type PeriodOption = { period_number: number; name: string; starts_at: string; ends_at: string };
type ClassSubject = { class_id: string; subject_id: string };
type TimetableValues = {
  id?: string;
  academicSessionId?: string;
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  teacherId?: string;
  periodNumber?: number;
  dayOfWeek?: number;
  room?: string | null;
  status?: "active" | "inactive" | "archived";
};

function Feedback({ state }: { state: TimetableFormState | undefined }) {
  return (
    <>
      {state?.error && <p className="student-error" role="status">{state.error}</p>}
      {state?.success && <p className="student-success" role="status">{state.success}</p>}
    </>
  );
}

export function TimetableForm({
  sessions,
  classes,
  sections,
  subjects,
  teachers,
  classSubjects,
  teacherAssignments,
  periods,
  workingDays,
  initialValues,
}: {
  sessions: Option[];
  classes: Option[];
  sections: SectionOption[];
  subjects: Option[];
  teachers: Option[];
  classSubjects: ClassSubject[];
  teacherAssignments: TeacherSubjectAssignment[];
  periods: PeriodOption[];
  workingDays: number[];
  initialValues?: TimetableValues;
}) {
  const [state, action] = useActionState(saveTimetableEntry, undefined);
  const [academicSessionId, setAcademicSessionId] = useState(
    initialValues?.academicSessionId ?? sessions[0]?.id ?? "",
  );
  const [classId, setClassId] = useState(initialValues?.classId ?? "");
  const [sectionId, setSectionId] = useState(initialValues?.sectionId ?? "");
  const [subjectId, setSubjectId] = useState(initialValues?.subjectId ?? "");
  const [teacherId, setTeacherId] = useState(initialValues?.teacherId ?? "");
  const isEditing = Boolean(initialValues?.id);
  const classSections = sections.filter((section) => section.class_id === classId);
  const availableSubjects = subjects.filter((subject) =>
    classSubjects.some((assignment) => assignment.class_id === classId && assignment.subject_id === subject.id));
  const assignedTeacherIds = getAssignedTeacherIds(teacherAssignments, academicSessionId, subjectId, classId);
  const availableTeachers = teachers.filter((teacher) => assignedTeacherIds.has(teacher.id));
  const availableWorkingDays = timetableDays.filter(({ day }) => workingDays.includes(day));

  if (!sessions.length || !classes.length || !sections.length || !subjects.length || !teachers.length || !periods.length) {
    return (
      <div className="timetable-prerequisite">
        <p>Before scheduling a lesson, set up at least one academic session, active class and section, active subject, and active teacher.</p>
        <div>
          {!sessions.length && <Link href="/setup?section=sessions">Academic sessions</Link>}
          {!classes.length && <Link href="/setup?section=classes">Classes</Link>}
          {!sections.length && <Link href="/setup?section=sections">Sections</Link>}
          {!subjects.length && <Link href="/setup?section=subjects">Subjects</Link>}
          {!teachers.length && <Link href="/teachers">Teachers</Link>}
          {!periods.length && <Link href="#periods">Configure daily periods</Link>}
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="student-form timetable-form">
      <Feedback state={state} />
      <input type="hidden" name="id" value={initialValues?.id ?? ""} />
      <div className="student-form-grid">
        <label className="student-field">
          Academic session
          <select name="academicSessionId" value={academicSessionId} required
            onChange={(event) => {
              setAcademicSessionId(event.target.value);
              setTeacherId("");
            }}>
            <option value="" disabled>Select academic session</option>
            {sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
          </select>
        </label>
        <label className="student-field">
          Class
          <select name="classId" value={classId} required onChange={(event) => {
            setClassId(event.target.value);
            setSectionId("");
            setSubjectId("");
            setTeacherId("");
          }}>
            <option value="" disabled>Select class</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="student-field">
          Section
          <select name="sectionId" value={classSections.some((section) => section.id === sectionId) ? sectionId : ""} required
            disabled={!classId || !classSections.length} onChange={(event) => setSectionId(event.target.value)}>
            <option value="" disabled>{!classId ? "Select class first" : "Select section"}</option>
            {classSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
          </select>
        </label>
        <label className="student-field">
          Subject
          <select name="subjectId" value={availableSubjects.some((subject) => subject.id === subjectId) ? subjectId : ""} required
            disabled={!classId || !availableSubjects.length}
            onChange={(event) => {
              setSubjectId(event.target.value);
              setTeacherId("");
            }}>
            <option value="" disabled>{!classId ? "Select class first" : availableSubjects.length ? "Select subject" : "No subjects assigned to this class"}</option>
            {availableSubjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="student-field">
          Teacher
          <select name="teacherId" value={availableTeachers.some((teacher) => teacher.id === teacherId) ? teacherId : ""} required
            disabled={!subjectId || !availableTeachers.length}
            onChange={(event) => setTeacherId(event.target.value)}>
            <option value="" disabled>{!subjectId ? "Select subject first" : availableTeachers.length ? "Select assigned teacher" : "No teacher assigned for this class and session"}</option>
            {availableTeachers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="student-field">
          Daily period
          <select name="periodNumber" defaultValue={String(initialValues?.periodNumber ?? "")} required>
            <option value="" disabled>Select period</option>
            {periods.map((period) => <option key={period.period_number} value={period.period_number}>
              {period.period_number}. {period.name} · {period.starts_at.slice(0, 5)}–{period.ends_at.slice(0, 5)}
            </option>)}
          </select>
        </label>
        <label className="student-field">
          Day
          <select name="dayOfWeek" defaultValue={String(
            initialValues?.dayOfWeek && workingDays.includes(initialValues.dayOfWeek)
              ? initialValues.dayOfWeek
              : (availableWorkingDays[0]?.day ?? defaultTimetableWorkingDays[0])
          )} required>
            {availableWorkingDays.map(({ day, name }) => <option key={day} value={day}>{name}</option>)}
          </select>
        </label>
        <label className="student-field">Room <span className="account-optional-label">Optional</span><input name="room" maxLength={80} defaultValue={initialValues?.room ?? ""} placeholder="Room 101" /></label>
        <label className="student-field">
          Status
          <select name="status" defaultValue={initialValues?.status ?? "active"}>
            <option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option>
          </select>
        </label>
      </div>
      {classId && !availableSubjects.length && <p className="exams-inline-hint">Assign school subjects to this class in <Link href="/setup?section=assignments">School Setup → Class subjects</Link>. A school subject can be reused by multiple classes.</p>}
      {subjectId && !availableTeachers.length && <p className="exams-inline-hint">No teacher is assigned to this subject for the selected class and session. Add the teacher&apos;s assignment through HRM/Curriculum.</p>}
      <div className="timetable-form__actions">
        <SubmitButton>{isEditing ? "Save timetable changes" : "Add timetable entry"}</SubmitButton>
        {isEditing && <a className="text-action" href="/timetable">Cancel editing</a>}
      </div>
    </form>
  );
}
