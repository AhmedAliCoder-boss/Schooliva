"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { getSlcTcStudentDetails, issueSlcTc, reviewStudentCertificate, type SlcTcExamOption } from "@/app/actions/documents";
import { SubmitButton } from "@/components/auth/submit-button";
import type { DocumentFormState } from "@/lib/documents/schemas";

export type SlcTcStudentOption = {
  id: string;
  name: string;
  studentId: string;
  admissionNumber: string;
  dateOfBirth: string;
  admissionDate: string;
  classId: string;
  sectionId: string;
  academicSessionId: string;
  className: string;
  sectionName: string;
  sessionName: string;
};

export type SlcTcClassSectionOption = {
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
};

export type SlcTcSessionOption = { id: string; name: string };

export type SlcTcHistoryRow = {
  id: string;
  certificateNumber: string;
  certificateTitle: string;
  issuedOn: string;
  studentName: string;
  studentId: string;
};
export type SlcTcPendingApprovalRow = SlcTcHistoryRow & { certificateType: "character" | "leaving" | "completion" };
type CertificateKind = "slc_tc" | "character" | "completion";
type SlcTcFeeStatus = "cleared" | "pending" | "not_recorded" | "waived";

function isSlcTcFeeStatus(value: string): value is SlcTcFeeStatus {
  return value === "cleared" || value === "pending" || value === "not_recorded" || value === "waived";
}

function Feedback({ state }: { state: DocumentFormState | undefined }) {
  return <>
    {state?.error && <p className="student-error" role="alert">{state.error}</p>}
    {state?.success && <p className="student-success" role="status">{state.success}</p>}
  </>;
}

function CertificateDetails({
  student,
  today,
  kind,
  classSections,
  sessions,
  nextCertificateNumber,
  examOptions,
  feeStatus,
  onFeeStatusChange,
}: {
  student: SlcTcStudentOption;
  today: string;
  kind: CertificateKind;
  classSections: SlcTcClassSectionOption[];
  sessions: SlcTcSessionOption[];
  nextCertificateNumber: string | null;
  examOptions: SlcTcExamOption[];
  feeStatus: SlcTcFeeStatus;
  onFeeStatusChange: (status: SlcTcFeeStatus) => void;
}) {
  const currentClassSection = `${student.classId}|${student.sectionId}`;
  const initialClassSection = classSections.some((item) => `${item.classId}|${item.sectionId}` === currentClassSection)
    ? currentClassSection
    : "";
  const completionDetailsForClass = (value: string) => {
    const selectedClass = classSections.find((item) => `${item.classId}|${item.sectionId}` === value);
    const className = selectedClass
      ? `${selectedClass.className}${selectedClass.sectionName ? ` (${selectedClass.sectionName})` : ""} grade`
      : "the selected class/grade";
    return `This is to certify that ${student.name} has successfully completed ${className} at this school.`;
  };
  const [lastClassSection, setLastClassSection] = useState(initialClassSection);
  const [completionDetails, setCompletionDetails] = useState(() => completionDetailsForClass(initialClassSection));
  const [completionDetailsEdited, setCompletionDetailsEdited] = useState(false);
  return <fieldset className="slc-tc-fields" key={`${student.id}-${kind}`}>
    {kind === "character" ? <>
      <label className="student-field">Certificate number<input name="certificateNumber" value={nextCertificateNumber ?? ""} readOnly required pattern="\d{4}" /></label>
      <label className="student-field">Issue date<input name="issuedOn" type="date" defaultValue={today} required /></label>
      <label className="student-field">Conduct<select name="conduct" defaultValue="Good" required><option>Excellent</option><option>Very good</option><option>Good</option><option>Satisfactory</option><option>Needs improvement</option></select></label>
      <label className="student-field student-field-wide">Character certificate statement<textarea name="certificateText" rows={5} defaultValue="During the period of study, the student's conduct and character were found to be good. We wish the student success in future endeavours." required maxLength={2000} /></label>
      <label className="student-field student-field-wide">Additional remarks<textarea name="remarks" rows={3} maxLength={1000} /></label>
    </> : <>
    <label className="student-field">Certificate type
      <select name="certificateTitle" defaultValue={kind === "completion" ? "School Completion Certificate" : "School Leaving Certificate"} required>
        {kind === "completion"
          ? <option value="School Completion Certificate">School Completion Certificate</option>
          : <>
            <option value="School Leaving Certificate">School Leaving Certificate (SLC)</option>
            <option value="Transfer Certificate">Transfer Certificate (TC)</option>
          </>}
      </select>
    </label>
    <label className="student-field">Certificate number<input name="certificateNumber" value={nextCertificateNumber ?? ""} readOnly required pattern="\d{4}" /></label>
    <label className="student-field">Issue date<input name="issuedOn" type="date" defaultValue={today} required /></label>
    <label className="student-field">{kind === "completion" ? "Completion date" : "Leaving date"}<input name="dateOfLeaving" type="date" defaultValue={today} required /></label>
    <label className="student-field">Admission date
      {student.admissionDate
        ? <input name="dateOfAdmission" type="date" value={student.admissionDate} readOnly required />
        : <><input type="text" value="Not recorded in student admission record" readOnly /><input name="dateOfAdmission" type="hidden" value="" /></>}
    </label>
    <label className="student-field">Date of birth
      {student.dateOfBirth
        ? <input name="dateOfBirth" type="date" value={student.dateOfBirth} readOnly required />
        : <><input type="text" value="Not recorded in student document record" readOnly /><input name="dateOfBirth" type="hidden" value="" /></>}
    </label>
    <label className="student-field">Last class attended
      <select name="lastClassSection" value={lastClassSection} onChange={(event) => {
        setLastClassSection(event.target.value);
        if (!completionDetailsEdited) setCompletionDetails(completionDetailsForClass(event.target.value));
      }} required>
        <option value="" disabled>Select active class and section</option>
        {classSections.map((item) => <option key={item.sectionId} value={`${item.classId}|${item.sectionId}`}>{item.className} · {item.sectionName}</option>)}
      </select>
    </label>
    <label className="student-field">Academic session
      <select name="academicSessionId" defaultValue={sessions.some((item) => item.id === student.academicSessionId) ? student.academicSessionId : sessions[0]?.id ?? ""} required>
        <option value="" disabled>Select current academic session</option>
        {sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
    <label className="student-field">Last exam / result
      <select name="lastExamId" defaultValue="">
        <option value="">No published result selected</option>
        {examOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
    <label className="student-field">Promotion status
      <select name="promotionStatus" defaultValue={kind === "completion" ? "Completed" : "Promoted"} required>
        <option>Promoted</option><option>Not promoted</option><option>Retained</option><option>Completed</option>
      </select>
    </label>
    <label className="student-field">Conduct<select name="conduct" defaultValue="Good" required><option>Excellent</option><option>Very good</option><option>Good</option><option>Satisfactory</option><option>Needs improvement</option></select></label>
    <label className="student-field">Fee status
      <select name="feeStatus" value={feeStatus} onChange={(event) => {
        if (isSlcTcFeeStatus(event.target.value)) onFeeStatusChange(event.target.value);
      }} required>
        <option value="cleared">Cleared</option><option value="pending">Pending</option><option value="waived">Waived</option><option value="not_recorded">No fee record</option>
      </select>
    </label>
    <label className="student-field student-field-wide">{kind === "completion" ? "Completion details" : "Reason for leaving"}<textarea
      name="reasonForLeaving"
      rows={3}
      value={kind === "completion" ? completionDetails : undefined}
      defaultValue={kind === "completion" ? undefined : ""}
      onChange={kind === "completion" ? (event) => {
        setCompletionDetails(event.target.value);
        setCompletionDetailsEdited(true);
      } : undefined}
      required
      maxLength={1000}
    /></label>
    <label className="student-field student-field-wide">Additional remarks<textarea name="remarks" rows={3} defaultValue={kind === "completion" ? "The student has completed the academic requirements of the school." : "The student has completed the academic requirements of the class and is leaving the school."} maxLength={1000} /></label>
    </>}
  </fieldset>;
}

function CertificateApprovalControls({ certificateId }: { certificateId: string }) {
  const [state, action] = useActionState(reviewStudentCertificate, undefined);
  return <form action={action} className="slc-tc-approval-actions">
    <input type="hidden" name="certificateId" value={certificateId} />
    <label className="student-field">Approval note<input name="notes" maxLength={1000} placeholder="Optional note" /></label>
    <div>
      <button type="submit" name="decision" value="approve" className="slc-tc-approval-actions__approve">Approve &amp; archive student</button>
      <button type="submit" name="decision" value="reject" className="slc-tc-approval-actions__reject">Reject</button>
    </div>
    <Feedback state={state} />
  </form>;
}

export function SlcTcWorkflow({
  students,
  history,
  pendingApprovals,
  canApproveCertificates,
  today,
  classSections,
  sessions,
  nextCertificateNumber,
}: {
  students: SlcTcStudentOption[];
  history: SlcTcHistoryRow[];
  pendingApprovals: SlcTcPendingApprovalRow[];
  canApproveCertificates: boolean;
  today: string;
  classSections: SlcTcClassSectionOption[];
  sessions: SlcTcSessionOption[];
  nextCertificateNumber: string | null;
}) {
  const [state, action] = useActionState(issueSlcTc, undefined);
  const [kind, setKind] = useState<CertificateKind>("slc_tc");
  const [studentId, setStudentId] = useState("");
  const [query, setQuery] = useState("");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [examOptions, setExamOptions] = useState<SlcTcExamOption[]>([]);
  const [feeStatus, setFeeStatus] = useState<SlcTcFeeStatus>("not_recorded");
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const student = students.find((item) => item.id === studentId) ?? null;
  const matching = students.filter((item) => `${item.name} ${item.studentId} ${item.admissionNumber}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0, 50);

  function chooseStudent(item: SlcTcStudentOption) {
    setStudentId(item.id);
    setQuery(`${item.name} · ${item.studentId}`);
    setExamOptions([]);
    setFeeStatus("not_recorded");
    setDetailsError("");
    setDetailsLoading(kind !== "character");
  }

  function chooseKind(nextKind: CertificateKind) {
    setKind(nextKind);
    setExamOptions([]);
    setFeeStatus("not_recorded");
    setDetailsError("");
    setDetailsLoading(Boolean(studentId) && nextKind !== "character");
  }

  useEffect(() => {
    if (!studentId || kind === "character") return;
    let isCurrent = true;
    getSlcTcStudentDetails(studentId).then((details) => {
      if (!isCurrent) return;
      if (details.error) {
        setDetailsError(details.error);
        setExamOptions([]);
        return;
      }
      setExamOptions(details.examOptions ?? []);
      setFeeStatus(details.feeStatus ?? "not_recorded");
    }).catch(() => {
      if (!isCurrent) return;
      setDetailsError("Student exam results or fee status could not be loaded.");
      setExamOptions([]);
    }).finally(() => {
      if (isCurrent) setDetailsLoading(false);
    });
    return () => { isCurrent = false; };
  }, [kind, studentId]);

  return <div className="slc-tc-layout">
    <section className="student-panel slc-tc-issue">
      <div className="student-panel-heading"><div><h2>Prepare certificate</h2><p>Select an active student and complete the details for SLC, TC, or school completion.</p></div><span>New issue</span></div>
      <form action={action} className="student-form">
        <Feedback state={state} />
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="certificateKind" value={kind} />
        <div className="slc-tc-kind-selector" role="group" aria-label="Certificate type">
          <button type="button" className={kind === "slc_tc" ? "active" : ""} aria-pressed={kind === "slc_tc"} onClick={() => chooseKind("slc_tc")}>SLC / Transfer Certificate</button>
          <button type="button" className={kind === "completion" ? "active" : ""} aria-pressed={kind === "completion"} onClick={() => chooseKind("completion")}>School Completion Certificate</button>
          <button type="button" className={kind === "character" ? "active" : ""} aria-pressed={kind === "character"} onClick={() => chooseKind("character")}>Character Certificate</button>
        </div>
        <div className="slc-tc-picker">
          <label className="student-field">Student
            <input
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={optionsOpen}
              aria-controls="slc-tc-student-options"
              autoComplete="off"
              placeholder="Search student name or Schooliva ID"
              value={query}
              required
              onFocus={() => setOptionsOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setStudentId("");
                setExamOptions([]);
                setFeeStatus("not_recorded");
                setDetailsError("");
                setDetailsLoading(false);
                setOptionsOpen(true);
              }}
              onBlur={() => window.setTimeout(() => setOptionsOpen(false), 120)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOptionsOpen(false);
                if (event.key === "Enter" && optionsOpen && matching.length) {
                  event.preventDefault();
                  chooseStudent(matching[0]);
                  setOptionsOpen(false);
                }
              }}
            />
          </label>
          {optionsOpen && <div className="slc-tc-picker__options" id="slc-tc-student-options" role="listbox" aria-label="Students">
            {matching.length ? matching.map((item) => <button
              type="button"
              role="option"
              aria-selected={item.id === studentId}
              key={item.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                chooseStudent(item);
                setOptionsOpen(false);
              }}
            ><span>{item.name}</span><small>{item.studentId}</small></button>) : <p>No active students match this search.</p>}
          </div>}
        </div>
        {student ? <>
          <div className="slc-tc-student-summary">
            <strong>{student.name}</strong>
            <span>Student ID: {student.studentId}</span>
            <span>Admission no.: {student.admissionNumber || "—"}</span>
            <span>Current class: {[student.className, student.sectionName].filter(Boolean).join(" / ") || "Not enrolled"}</span>
          </div>
          {kind !== "character" && detailsLoading && <p className="slc-tc-select-prompt" role="status">Loading published exam results and fee status…</p>}
          {kind !== "character" && detailsError && <p className="student-error" role="alert">{detailsError}</p>}
          <CertificateDetails key={`${student.id}-${kind}`} student={student} today={today} kind={kind} classSections={classSections} sessions={sessions} nextCertificateNumber={nextCertificateNumber} examOptions={examOptions} feeStatus={feeStatus} onFeeStatusChange={setFeeStatus} />
          <SubmitButton disabled={!nextCertificateNumber || (kind !== "character" && (detailsLoading || Boolean(detailsError) || !sessions.length || !classSections.length || !student.admissionDate || !student.dateOfBirth))}>{kind === "character" ? "Request character certificate" : kind === "completion" ? "Request school completion certificate" : "Request SLC / TC"}</SubmitButton>
        </> : <p className="slc-tc-select-prompt">Choose a student to enter and issue their certificate.</p>}
      </form>
    </section>

    <section className="student-panel slc-tc-history">
      <div className="student-panel-heading"><div><h2>Awaiting approval</h2><p>Only a School Admin or Principal can approve or reject these requests.</p></div><span>{pendingApprovals.length} requests</span></div>
      <div className="student-table-wrap"><table className="student-table">
        <thead><tr><th>Certificate</th><th>Student</th><th>Student ID</th><th>Number</th><th>Requested</th><th>Decision</th></tr></thead>
        <tbody>{pendingApprovals.length ? pendingApprovals.map((item) => <tr key={item.id}>
          <td>{item.certificateTitle}</td>
          <td>{item.studentName}</td>
          <td>{item.studentId}</td>
          <td>{item.certificateNumber}</td>
          <td>{item.issuedOn}</td>
          <td>{canApproveCertificates
            ? <CertificateApprovalControls certificateId={item.id} />
            : <span>Admin / Principal approval required</span>}</td>
        </tr>) : <tr><td colSpan={6}><div className="student-empty"><h3>No approvals waiting</h3><p>New student certificate requests will appear here.</p></div></td></tr>}</tbody>
      </table></div>
    </section>

    <section className="student-panel slc-tc-history">
      <div className="student-panel-heading"><div><h2>Approved student certificates</h2><p>Previously approved SLC / TC, school completion, and character certificates.</p></div><span>{history.length} records</span></div>
      <div className="student-table-wrap"><table className="student-table">
        <thead><tr><th>Certificate</th><th>Student</th><th>Student ID</th><th>Issued</th><th>Document</th></tr></thead>
        <tbody>{history.length ? history.map((item) => <tr key={item.id}>
          <td><strong>{item.certificateTitle}</strong><small>{item.certificateNumber}</small></td>
          <td>{item.studentName}</td>
          <td>{item.studentId}</td>
          <td>{item.issuedOn}</td>
          <td><Link className="text-action" href={`/documents/certificates/${item.id}`}>Open / print →</Link></td>
        </tr>) : <tr><td colSpan={5}><div className="student-empty"><h3>No student certificates issued yet</h3><p>Approved certificates will be listed here.</p></div></td></tr>}</tbody>
      </table></div>
    </section>
  </div>;
}
