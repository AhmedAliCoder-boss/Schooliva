"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { saveExamSchedule } from "@/app/actions/exams";
import { SubmitButton } from "@/components/auth/submit-button";

type ExamOption = {
  id: string;
  name: string;
  academic_session_id: string;
  starts_on: string;
  ends_on: string;
};
type TermOption = {
  id: string;
  name: string;
  academic_session_id: string;
  starts_on: string;
  ends_on: string;
};
type ClassOption = { id: string; name: string };
type SectionOption = { id: string; name: string; class_id: string };
type SubjectOption = { id: string; subject_id: string; name: string; class_id: string; exam_id: string };
type ExaminerOption = { id: string; name: string };
export function ExamTimetableBuilder({
  exams,
  terms,
  classes,
  sections,
  subjects,
  examiners,
  lockedSections,
  initialExamId = "",
  initialClassId = "",
  initialSectionId = "",
}: {
  exams: ExamOption[];
  terms: TermOption[];
  classes: ClassOption[];
  sections: SectionOption[];
  subjects: SubjectOption[];
  examiners: ExaminerOption[];
  lockedSections: string[];
  initialExamId?: string;
  initialClassId?: string;
  initialSectionId?: string;
}) {
  const [state, action] = useActionState(saveExamSchedule, undefined);
  const [examId, setExamId] = useState(initialExamId);
  const [classId, setClassId] = useState(initialClassId);
  const [sectionId, setSectionId] = useState(initialSectionId);
  const [termId, setTermId] = useState("");
  const [examSubjectId, setExamSubjectId] = useState("");
  const [examinerTeacherId, setExaminerTeacherId] = useState("");
  const exam = exams.find((item) => item.id === examId);
  const examTerms = terms.filter((term) => term.academic_session_id === exam?.academic_session_id);
  const classSubjects = subjects.filter((subject) => subject.exam_id === examId && subject.class_id === classId);
  const classSections = sections.filter((section) => section.class_id === classId
    && !lockedSections.includes(`${examId}:${section.id}`));
  const term = examTerms.find((item) => item.id === termId);
  const minDate = !exam ? "" : !term || exam.starts_on > term.starts_on ? exam.starts_on : term.starts_on;
  const maxDate = !exam ? "" : !term || exam.ends_on < term.ends_on ? exam.ends_on : term.ends_on;

  return (
    <form action={action} className="student-form exam-timetable-builder">
      {state?.error && <p className="student-error" role="status">{state.error}</p>}
      {state?.success && <p className="student-success" role="status">{state.success}</p>}
      <div className="student-form-grid">
        <label className="student-field">Exam
          <select name="examId" value={examId} required onChange={(event) => {
            setExamId(event.target.value);
            setClassId("");
            setSectionId("");
            setTermId("");
            setExamSubjectId("");
            setExaminerTeacherId("");
          }}>
            <option value="" disabled>Select exam</option>
            {exams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="student-field">Class
          <select name="classId" value={classId} required disabled={!exam} onChange={(event) => {
            setClassId(event.target.value);
            setSectionId("");
            setExamSubjectId("");
            setExaminerTeacherId("");
          }}>
            <option value="" disabled>{exam ? "Select class" : "Select exam first"}</option>
            {classes.filter((item) => subjects.some((subject) => subject.exam_id === examId && subject.class_id === item.id))
              .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="student-field">Section
          <select name="sectionId" value={classSections.some((item) => item.id === sectionId) ? sectionId : ""} required disabled={!classId || !classSections.length}
            onChange={(event) => setSectionId(event.target.value)}>
            <option value="" disabled>{!classId ? "Select class first" : classSections.length ? "Select section" : "All sections submitted"}</option>
            {classSections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="student-field">Academic term
          <select name="academicTermId" value={termId} required disabled={!exam || !examTerms.length}
            onChange={(event) => setTermId(event.target.value)}>
            <option value="" disabled>{exam ? "Select academic term" : "Select exam first"}</option>
            {examTerms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="student-field">Subject
          <select name="examSubjectId" value={examSubjectId} required disabled={!classId || !classSubjects.length}
            onChange={(event) => {
              setExamSubjectId(event.target.value);
              setExaminerTeacherId("");
            }}>
            <option value="" disabled>{classId ? "Select subject" : "Select class first"}</option>
            {classSubjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="student-field">Examiner
          <select name="examinerTeacherId" value={examiners.some((item) => item.id === examinerTeacherId) ? examinerTeacherId : ""} required disabled={!examiners.length}
            onChange={(event) => setExaminerTeacherId(event.target.value)}>
            <option value="" disabled>{examiners.length ? "Select teacher" : "No active teachers available"}</option>
            {examiners.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="student-field">Exam date
          <input name="scheduledOn" type="date" min={minDate || undefined} max={maxDate || undefined} required />
          {term && exam && <small>{minDate} to {maxDate}</small>}
        </label>
        <label className="student-field">Starts at<input name="startsAt" type="time" required /></label>
        <label className="student-field">Ends at<input name="endsAt" type="time" required /></label>
        <label className="student-field">Room <span className="account-optional-label">Optional</span>
          <input name="room" maxLength={80} placeholder="Exam hall" />
        </label>
      </div>
      {exam && !subjects.some((subject) => subject.exam_id === examId)
        && <p className="exams-inline-hint">This draft has no class subjects yet. <Link href={`/exams/${examId}`}>Add exam subjects first →</Link></p>}
      {exam && !examTerms.length
        && <p className="exams-inline-hint">No academic term belongs to this exam&apos;s session. Add or activate a matching academic term in Setup.</p>}
      {exam && classId && !classSections.length
        && <p className="exams-inline-hint">Every section in this class has already been submitted for marking.</p>}
      {!examiners.length
        && <p className="exams-inline-hint">No active teachers are available to act as examiners. Add or activate a teacher in HRM.</p>}
      <div className="timetable-form__actions">
        <SubmitButton disabled={!examiners.length}>Generate exam schedule</SubmitButton>
      </div>
    </form>
  );
}
