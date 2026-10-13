"use client";

import { useActionState, useState } from "react";

import {
  addHrmCandidate,
  completeHrmHire,
  createJobOpening,
  scheduleHrmInterview,
  setJobOpeningStatus,
  updateCandidateStage,
  updateHrmInterviewStatus,
} from "@/app/actions/hrm";
import { SubmitButton } from "@/components/auth/submit-button";
import type { HrmFormState } from "@/lib/hrm/schemas";

type JobOption = { id: string; title: string; employee_type: "teacher" | "staff" };
type CandidateOption = { id: string; candidate_name: string; job_title: string | null };

export function HrmLocalDateTime({ value }: { value: string }) {
  const date = new Date(value);
  return <time dateTime={value}>{`${date.toISOString().slice(0, 16).replace("T", " ")} UTC`}</time>;
}

function Feedback({ state }: { state: HrmFormState | undefined }) {
  return <>
    {state?.error && <p className="student-error" role="alert">{state.error}</p>}
    {state?.success && <p className="student-success" role="status">{state.success}</p>}
  </>;
}

export function JobOpeningForm() {
  const [state, action] = useActionState(createJobOpening, undefined);
  return <form action={action} className="student-form hrm-form">
    <Feedback state={state} />
    <div className="student-form-grid">
      <label className="student-field">Job title<input name="title" minLength={2} maxLength={160} placeholder="e.g. Mathematics teacher" required /></label>
      <label className="student-field">Department<input name="department" maxLength={100} placeholder="e.g. Academics" /></label>
      <label className="student-field">Employee record type<select name="employeeType" defaultValue="staff"><option value="teacher">Teacher</option><option value="staff">Staff</option></select><small>This determines which permanent employee record is created when a candidate is hired.</small></label>
      <label className="student-field">Employment type<select name="employmentType" defaultValue="full_time"><option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="contract">Contract</option><option value="temporary">Temporary</option></select></label>
      <label className="student-field">Location<input name="location" maxLength={160} placeholder="Campus or city" /></label>
      <label className="student-field">Application deadline<input name="closingDate" type="date" /></label>
      <label className="student-field">Initial status<select name="status" defaultValue="open"><option value="open">Open</option><option value="draft">Draft</option></select></label>
      <label className="student-field student-field-wide">Job description<textarea name="description" maxLength={5000} rows={3} placeholder="Responsibilities and role summary" /></label>
      <label className="student-field student-field-wide">Requirements<textarea name="requirements" maxLength={5000} rows={3} placeholder="Qualifications, experience, and skills" /></label>
    </div>
    <SubmitButton>Save vacancy</SubmitButton>
  </form>;
}

export function JobOpeningStatusForm({ id, status }: { id: string; status: "draft" | "open" | "closed" }) {
  const [state, action] = useActionState(setJobOpeningStatus, undefined);
  const nextStatus = status === "open" ? "closed" : "open";
  return <form action={action} className="hrm-inline-action">
    <input type="hidden" name="jobId" value={id} />
    <input type="hidden" name="status" value={nextStatus} />
    <button type="submit">{status === "open" ? "Close vacancy" : status === "draft" ? "Publish" : "Reopen"}</button>
    <Feedback state={state} />
  </form>;
}

export function CandidateForm({ jobs }: { jobs: JobOption[] }) {
  const [state, action] = useActionState(addHrmCandidate, undefined);
  return <form action={action} className="student-form hrm-form">
    <Feedback state={state} />
    <div className="student-form-grid">
      <label className="student-field">Candidate name<input name="candidateName" minLength={2} maxLength={160} required /></label>
      <label className="student-field">Email<input name="email" type="email" maxLength={254} /></label>
      <label className="student-field">Phone<input name="phone" type="tel" maxLength={40} /></label>
      <label className="student-field">Vacancy<select name="jobId" defaultValue=""><option value="">General application</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title} · {job.employee_type === "teacher" ? "Teacher" : "Staff"}</option>)}</select></label>
      <label className="student-field">Application source<select name="source" defaultValue="other"><option value="website">Website</option><option value="walk_in">Walk-in</option><option value="referral">Referral</option><option value="social_media">Social media</option><option value="other">Other</option></select></label>
      <label className="student-field student-field-wide">Notes<textarea name="notes" maxLength={2000} rows={3} /></label>
    </div>
    <SubmitButton>Add candidate</SubmitButton>
  </form>;
}

export function CandidateStageForm({ id, stage, jobId, jobs }: { id: string; stage: string; jobId: string | null; jobs: JobOption[] }) {
  const [state, action] = useActionState(updateCandidateStage, undefined);
  return <form action={action} className="hrm-stage-form">
    <input type="hidden" name="candidateId" value={id} />
    <select name="jobId" defaultValue={jobId ?? ""} aria-label="Assign candidate to vacancy">
      <option value="">General application</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
    </select>
    <select name="stage" defaultValue={stage} aria-label="Candidate hiring stage">
      <option value="applied">Applied</option><option value="screening">Screening</option><option value="interview">Interview</option>
      <option value="offer">Offer</option><option value="rejected">Rejected</option>
    </select>
    <SubmitButton>Update</SubmitButton>
    <Feedback state={state} />
  </form>;
}

export function CompleteHireForm({
  candidateId,
  employeeType,
  sessions,
  subjects,
  classes,
  classSubjects,
}: {
  candidateId: string;
  employeeType: "teacher" | "staff";
  sessions: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; name: string }>;
  classSubjects: Array<{ class_id: string; subject_id: string }>;
}) {
  const [state, action] = useActionState(completeHrmHire, undefined);
  const [assignments, setAssignments] = useState([{ subjectId: "", classId: "" }]);
  return <form action={action} className="hrm-hire-form">
    <input type="hidden" name="candidateId" value={candidateId} />
    <input type="hidden" name="employeeType" value={employeeType} />
    {state?.error && <p className="student-error" role="alert">{state.error}</p>}
    {state?.success && <p className="student-success" role="status">{state.success}</p>}
    {state?.employeeCode && <p className="student-success" role="status">Employee ID: <strong>{state.employeeCode}</strong></p>}
    {employeeType === "teacher" && <>
      <label className="student-field">Academic session
        <select name="academicSessionId" required defaultValue="">
          <option value="">Select active academic session</option>
          {sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
        </select>
      </label>
      <div className="hrm-hire-subjects">
        <strong>Teacher subjects</strong>
        <small>Select from the school-wide subject catalog. Reuse a subject across classes; choose a class only when this teacher&apos;s assignment is class-specific.</small>
        {assignments.map((assignment, index) => {
          const eligibleClassIds = new Set(classSubjects.filter((item) => item.subject_id === assignment.subjectId).map((item) => item.class_id));
          return <div className="hrm-hire-subject-row" key={index}>
            <label className="student-field">Subject
              <select required value={assignment.subjectId} onChange={(event) => setAssignments((current) => current.map((row, rowIndex) => rowIndex === index ? { subjectId: event.target.value, classId: "" } : row))}>
                <option value="">Select subject</option>
                {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            </label>
            <label className="student-field">Class (optional)
              <select value={assignment.classId} disabled={!assignment.subjectId} onChange={(event) => setAssignments((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, classId: event.target.value } : row))}>
                <option value="">All classes</option>
                {classes.filter((cls) => eligibleClassIds.has(cls.id)).map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
              </select>
            </label>
            {assignments.length > 1 && <button type="button" className="hrm-hire-subject-remove" onClick={() => setAssignments((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remove</button>}
          </div>;
        })}
        <input type="hidden" name="subjectAssignments" value={JSON.stringify(assignments)} />
        <button type="button" className="table-edit" onClick={() => setAssignments((current) => [...current, { subjectId: "", classId: "" }])}>Add another subject</button>
        {!sessions.length && <p className="student-error">Add an active academic session before hiring a teacher.</p>}
        {!subjects.length && <p className="student-error">Add active subjects in School Setup before hiring a teacher.</p>}
      </div>
    </>}
    {employeeType === "staff" && <input type="hidden" name="subjectAssignments" value="[]" />}
    <SubmitButton disabled={employeeType === "teacher" && (!sessions.length || !subjects.length)}>Complete hire</SubmitButton>
  </form>;
}

export function InterviewScheduleForm({ candidates }: { candidates: CandidateOption[] }) {
  const [state, action] = useActionState(scheduleHrmInterview, undefined);
  const [scheduledAt, setScheduledAt] = useState("");
  return <form action={action} className="student-form hrm-form">
    <Feedback state={state} />
    {candidates.length ? <div className="student-form-grid">
      <label className="student-field">Candidate<select name="candidateId" required defaultValue=""><option value="">Select candidate</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.candidate_name}{candidate.job_title ? ` · ${candidate.job_title}` : ""}</option>)}</select></label>
      <label className="student-field">Date and time<input type="datetime-local" name="scheduledAtLocal" required onChange={(event) => {
        const value = event.currentTarget.value;
        setScheduledAt(value ? new Date(value).toISOString() : "");
      }} /></label>
      <input type="hidden" name="scheduledAt" value={scheduledAt} />
      <label className="student-field">Interview type<select name="interviewType" defaultValue="in_person"><option value="in_person">In person</option><option value="video">Video call</option><option value="phone">Phone</option></select></label>
      <label className="student-field">Location / meeting link<input name="location" maxLength={300} /></label>
      <label className="student-field">Interviewer<input name="interviewer" maxLength={160} /></label>
      <label className="student-field student-field-wide">Notes<textarea name="notes" maxLength={2000} rows={3} /></label>
    </div> : <p className="student-muted">Add a candidate before scheduling an interview.</p>}
    {candidates.length > 0 && <SubmitButton>Schedule interview</SubmitButton>}
  </form>;
}

export function InterviewStatusForm({ id, status }: { id: string; status: string }) {
  const [state, action] = useActionState(updateHrmInterviewStatus, undefined);
  if (status !== "scheduled") return <span className={`hrm-status hrm-status--${status}`}>{status}</span>;
  return <form action={action} className="hrm-inline-action">
    <input type="hidden" name="interviewId" value={id} />
    <select name="status" defaultValue="completed" aria-label="Interview result"><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>
    <SubmitButton>Save</SubmitButton>
    <Feedback state={state} />
  </form>;
}
