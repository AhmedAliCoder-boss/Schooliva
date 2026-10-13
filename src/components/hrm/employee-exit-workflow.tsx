"use client";

import { useState } from "react";
import { useActionState } from "react";

import { requestHrmEmployeeExit, reviewHrmEmployeeExit } from "@/app/actions/hrm";
import { SubmitButton } from "@/components/auth/submit-button";
import type { HrmFormState } from "@/lib/hrm/schemas";

type ExitEmployeeOption = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  type: "teacher" | "staff";
  role: string;
  department: string | null;
  email: string | null;
  phone: string | null;
  joining_date: string | null;
  date_of_birth: string | null;
  gender: string | null;
  qualification: string | null;
  address: string | null;
  employment_status: string;
  idCardHref: string;
};

type ExitRequest = {
  id: string;
  employeeId: string;
  employeeType: "teacher" | "staff";
  employeeName: string;
  employeeCode: string;
  employeeRole: string;
  department: string | null;
  email: string | null;
  phone: string | null;
  joiningDate: string | null;
  employmentStatus: string;
  idCardHref: string;
  actionType: "resignation" | "termination" | "warning";
  terminatedOn: string;
  createdAt: string;
  decisionAt: string | null;
  reason: string;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  decisionNotes: string | null;
  resignationLetterUrl: string | null;
};

function FormFeedback({ state }: { state: HrmFormState | undefined }) {
  return <>
    {state?.error && <p className="student-error" role="alert">{state.error}</p>}
    {state?.fieldErrors && <ul className="student-error" role="alert">
      {Object.values(state.fieldErrors).flat().map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}
    </ul>}
    {state?.success && <p className="student-success" role="status">{state.success}</p>}
  </>;
}

export function EmployeeDetails({ employee, showCard = false }: { employee: ExitEmployeeOption | ExitRequest; showCard?: boolean }) {
  const employeeName = "employeeName" in employee ? employee.employeeName : `${employee.first_name} ${employee.last_name}`;
  const employeeType = "type" in employee ? employee.type : employee.employeeType;
  const employeeCode = "employeeCode" in employee ? employee.employeeCode : employee.employee_code;
  const employmentStatus = "employment_status" in employee ? employee.employment_status : employee.employmentStatus;
  const joiningDate = "joining_date" in employee ? employee.joining_date : employee.joiningDate;
  const role = "role" in employee ? employee.role : employee.employeeRole;
  const rows = [
    ["Employee ID", employeeCode],
    ["Employee type", employeeType === "teacher" ? "Teacher" : "Staff"],
    ["Role", role],
    ["Department", employee.department],
    ["Employment status", employmentStatus],
    ["Joining date", joiningDate],
    ["Email", employee.email],
    ["Phone", employee.phone],
    ...("date_of_birth" in employee ? [
      ["Date of birth", employee.date_of_birth],
      ["Gender", employee.gender],
      ["Qualification", employee.qualification],
      ["Address", employee.address],
    ] : []),
  ] as const;
  return <div className="hrm-exit-employee-record">
    <div className="hrm-exit-employee-record__facts">
      {rows.filter(([, value]) => value).map(([label, value]) => <p key={label}><span>{label}</span><strong>{value}</strong></p>)}
      <a className="text-action" href={employee.idCardHref} target="_blank" rel="noreferrer">Open / print employee ID card →</a>
    </div>
    {showCard && <iframe className="hrm-exit-id-card-preview" src={employee.idCardHref} title={`Employee ID card for ${employeeName}`} loading="lazy" />}
  </div>;
}

export function EmployeeExitRequestForm({ employees }: { employees: ExitEmployeeOption[] }) {
  const [state, action] = useActionState(requestHrmEmployeeExit, undefined);
  const [selectedValue, setSelectedValue] = useState("");
  const [actionType, setActionType] = useState<"resignation" | "termination" | "warning">("resignation");
  const today = new Date().toISOString().slice(0, 10);
  const selectedEmployee = employees.find((employee) => `${employee.type}:${employee.id}` === selectedValue);
  const documentRequired = actionType !== "warning";
  const actionLabel = actionType === "resignation" ? "Resignation" : actionType === "termination" ? "Termination" : "Warning";

  return <section className="student-panel hrm-exit-compose">
    <div className="student-panel-heading"><h2>Employee case and decision</h2><span>Requires School Admin or Principal approval</span></div>
    <FormFeedback state={state} />
    <form action={action} className="student-form">
      <div className="student-form-grid">
        <label className="student-field student-field-wide">Employee
          <select name="employeeId" required value={selectedValue} onChange={(event) => setSelectedValue(event.target.value)}>
            <option value="">Select an active employee</option>
            {employees.map((employee) => <option key={`${employee.type}:${employee.id}`} value={`${employee.type}:${employee.id}`}>
              {employee.first_name} {employee.last_name} · {employee.employee_code} · {employee.type === "teacher" ? "Teacher" : employee.role}
            </option>)}
          </select>
        </label>
        <label className="student-field">Case type
          <select name="actionType" value={actionType} onChange={(event) => setActionType(event.target.value as typeof actionType)}>
            <option value="resignation">Employee resignation</option>
            <option value="termination">School termination</option>
            <option value="warning">Formal warning (employee remains active)</option>
          </select>
        </label>
        <label className="student-field">Effective / issued date
          <input name="terminationDate" type="date" max={today} defaultValue={today} required />
        </label>
        <label className="student-field student-field-wide">{actionType === "resignation" ? "Resignation reason" : actionType === "termination" ? "Termination reason" : "Warning / disciplinary reason"}
          <textarea name="reason" minLength={3} maxLength={500} rows={3} required />
        </label>
        <label className="student-field student-field-wide">Internal notes
          <textarea name="notes" maxLength={2000} rows={3} />
        </label>
        <label className="student-field student-field-wide">{actionType === "resignation" ? "Signed resignation letter" : actionType === "termination" ? "Termination notice / supporting document" : "Warning document (optional)"}
          <input name="supportingDocument" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" required={documentRequired} />
          <small>{documentRequired ? "Required PDF or image, up to 5 MB. Stored privately." : "Optional PDF or image, up to 5 MB. Stored privately."}</small>
        </label>
      </div>
      {selectedEmployee && <section className="hrm-exit-selected-employee">
        <div className="student-panel-heading"><h3>Selected employee record</h3><span>{selectedEmployee.first_name} {selectedEmployee.last_name}</span></div>
        <EmployeeDetails employee={selectedEmployee} showCard />
      </section>}
      <p className="student-form-note">{actionType === "warning"
        ? "An approved warning is retained in the employee's disciplinary history; it does not archive the employee or revoke access."
        : `An approved ${actionLabel.toLowerCase()} archives the employee and revokes their access to this school.`}</p>
      <SubmitButton>{`Send ${actionLabel.toLowerCase()} for approval`}</SubmitButton>
    </form>
  </section>;
}

export function EmployeeExitReviewForm({ request }: { request: ExitRequest }) {
  const [state, action] = useActionState(reviewHrmEmployeeExit, undefined);
  return <form
    action={action}
    className="hrm-exit-review-form"
    onSubmit={(event) => {
      const decision = (event.nativeEvent as SubmitEvent).submitter;
      if (decision instanceof HTMLButtonElement && decision.value === "approved"
        && !window.confirm(request.actionType === "warning"
          ? `Approve a formal warning for ${request.employeeName}? The employee will remain active and keep school access.`
          : `Approve ${request.actionType} for ${request.employeeName}? Employment will end and school access will be revoked.`)) {
        event.preventDefault();
      }
    }}
  >
    <input type="hidden" name="requestId" value={request.id} />
    <EmployeeDetails employee={request} />
    <label className="student-field">Decision notes
      <textarea name="decisionNotes" maxLength={2000} rows={2} defaultValue="" />
    </label>
    <div className="hrm-exit-review-actions">
      <button type="submit" name="decision" value="approved">{request.actionType === "warning" ? "Approve warning" : "Approve and archive"}</button>
      <button type="submit" name="decision" value="rejected">Reject request</button>
    </div>
    <FormFeedback state={state} />
  </form>;
}

export type { ExitEmployeeOption, ExitRequest };
