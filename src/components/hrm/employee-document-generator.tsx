"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { generateEmployeeDocument } from "@/app/actions/hrm";
import { SubmitButton } from "@/components/auth/submit-button";
import { SearchableOptionSelect } from "@/components/finance/searchable-student-select";
import type { HrmFormState } from "@/lib/hrm/schemas";

type EmployeeType = "teacher" | "staff";
export type GeneratedDocumentEmployeeOption = {
  id: string;
  type: EmployeeType;
  label: string;
};

const documentTypes = [
  ["appointment", "Appointment letter"],
  ["experience", "Experience letter"],
  ["employment_verification", "Employment verification letter"],
  ["promotion", "Promotion letter"],
  ["relieving", "Relieving letter"],
] as const;

const employmentTypes = [
  ["full_time", "Full-time"],
  ["part_time", "Part-time"],
  ["contract", "Contract"],
  ["temporary", "Temporary"],
] as const;

function isDocumentType(value: string): value is (typeof documentTypes)[number][0] {
  return documentTypes.some(([type]) => type === value);
}

function FormField({ label, name, placeholder, required = false, type = "text", maxLength }: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "date";
  maxLength?: number;
}) {
  return <label>{label}<input name={name} type={type} placeholder={placeholder} required={required} maxLength={maxLength} /></label>;
}

function LetterSpecificFields({ documentType }: { documentType: (typeof documentTypes)[number][0] }) {
  switch (documentType) {
    case "appointment":
      return <>
        <FormField label="Designation" name="designation" placeholder="Role / position" required maxLength={120} />
        <FormField label="Department / subject" name="department" placeholder="Department or subject area" maxLength={120} />
        <label>Employment type<select name="employmentType" defaultValue="full_time">{employmentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <FormField label="Joining / effective date" name="effectiveDate" type="date" required />
        <FormField label="Probation period" name="probationPeriod" placeholder="e.g. 3 months" maxLength={80} />
        <FormField label="Salary / compensation" name="salary" placeholder="e.g. 45,000 per month" maxLength={80} />
        <FormField label="Reporting to" name="reportingTo" placeholder="Supervisor / department head" maxLength={120} />
        <FormField label="Working hours" name="workingHours" placeholder="e.g. 8:00 AM – 2:00 PM" maxLength={120} />
      </>;
    case "experience":
      return <>
        <FormField label="Designation during service" name="designation" placeholder="Role / position" required maxLength={120} />
        <FormField label="Department / subject" name="department" placeholder="Department or subject area" maxLength={120} />
        <FormField label="Service start date" name="effectiveDate" type="date" required />
        <FormField label="Last working date" name="endDate" type="date" required />
        <label className="employee-document-generator__wide">Responsibilities
          <textarea name="responsibilities" maxLength={1200} rows={3} placeholder="Describe the employee's main responsibilities" />
        </label>
        <FormField label="Performance / conduct" name="performance" placeholder="e.g. Satisfactory" maxLength={300} />
      </>;
    case "employment_verification":
      return <>
        <FormField label="Designation" name="designation" placeholder="Role / position" required maxLength={120} />
        <FormField label="Department / subject" name="department" placeholder="Department or subject area" maxLength={120} />
        <FormField label="Letter addressed to" name="recipientName" placeholder="Organization / To whom it may concern" maxLength={160} />
        <FormField label="Purpose of verification" name="purpose" placeholder="e.g. Bank, visa, or employment verification" maxLength={300} />
        <FormField label="Salary / compensation (optional)" name="salary" placeholder="Include only if authorized" maxLength={80} />
      </>;
    case "promotion":
      return <>
        <FormField label="Previous designation" name="previousDesignation" placeholder="Previous role / position" required maxLength={120} />
        <FormField label="New designation" name="designation" placeholder="Promoted role / position" required maxLength={120} />
        <FormField label="New department / subject" name="department" placeholder="Department or subject area" maxLength={120} />
        <FormField label="Effective date" name="effectiveDate" type="date" required />
        <FormField label="Revised salary (optional)" name="salary" placeholder="e.g. 55,000 per month" maxLength={80} />
        <FormField label="Reporting to" name="reportingTo" placeholder="Supervisor / department head" maxLength={120} />
        <label className="employee-document-generator__wide">Promotion reason / remarks
          <textarea name="reason" maxLength={800} rows={3} placeholder="Optional reason or recognition" />
        </label>
      </>;
    case "relieving":
      return <>
        <FormField label="Designation held" name="designation" placeholder="Role / position" required maxLength={120} />
        <FormField label="Department / subject" name="department" placeholder="Department or subject area" maxLength={120} />
        <FormField label="Last working date" name="endDate" type="date" required />
        <FormField label="Reason for leaving" name="reason" placeholder="Resignation / end of contract / other" maxLength={300} />
        <FormField label="Clearance status" name="clearanceStatus" placeholder="e.g. Cleared / pending" maxLength={120} />
        <label className="employee-document-generator__wide">Handover / clearance details
          <textarea name="handoverDetails" maxLength={800} rows={3} placeholder="Record handover, assets, and any pending items" />
        </label>
      </>;
  }
}

function Feedback({ state }: { state: HrmFormState | undefined }) {
  return <>
    {state?.error && <p className="student-error" role="alert">{state.error}</p>}
    {state?.success && <p className="student-success" role="status">{state.success}</p>}
  </>;
}

export function EmployeeDocumentGenerator({ employees }: { employees: GeneratedDocumentEmployeeOption[] }) {
  const [state, action] = useActionState(generateEmployeeDocument, undefined);
  const firstEmployee = employees[0];
  const [employeeType, setEmployeeType] = useState<EmployeeType | "">(firstEmployee?.type ?? "");
  const [employeeId, setEmployeeId] = useState(firstEmployee?.id ?? "");
  const [documentType, setDocumentType] = useState<(typeof documentTypes)[number][0]>("appointment");
  const searchableEmployees = employees.map((employee) => ({
    id: `${employee.type}:${employee.id}`,
    name: employee.label,
  }));

  return <form action={action} className="employee-document-generator">
    <SearchableOptionSelect
      options={searchableEmployees}
      label="Employee"
      name="employeeSelection"
      placeholder="Search employee name, code, or role"
      defaultOptionId={firstEmployee ? `${firstEmployee.type}:${firstEmployee.id}` : ""}
      onSelectionChange={(value) => {
        const [type, id] = value.split(":");
        setEmployeeType(type === "teacher" || type === "staff" ? type : "");
        setEmployeeId(id ?? "");
      }}
    />
    <input type="hidden" name="employeeId" value={employeeId} />
    <input type="hidden" name="employeeType" value={employeeType} />
    <label>Document type
      <select name="documentType" value={documentType} onChange={(event) => {
        if (isDocumentType(event.currentTarget.value)) setDocumentType(event.currentTarget.value);
      }} required>
        {documentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    <label>Issue date
      <input name="issuedOn" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
    </label>
    <LetterSpecificFields documentType={documentType} />
    <label className="employee-document-generator__wide">Additional note
      <textarea name="notes" maxLength={1500} rows={3} placeholder="Optional approved note for the letter" />
    </label>
    <small className="employee-document-generator__hint">Generates a school-branded, print-ready letter and saves a permanent entry in the employee document register.</small>
    <Feedback state={state} />
    <div className="employee-document-generator__actions">
      <SubmitButton>Generate document</SubmitButton>
      {state?.generatedDocumentId && <Link className="student-secondary-action" href={`/documents/generated/${state.generatedDocumentId}`}>Open / print issued document</Link>}
    </div>
  </form>;
}
