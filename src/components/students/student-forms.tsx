"use client";

import { useActionState } from "react";

import { addStudentDocument, archiveStudent, updateStudent } from "@/app/actions/students";
import { SubmitButton } from "@/components/auth/submit-button";
import type { StudentFormState } from "@/lib/students/schemas";

type StudentRecord = Record<string, string | null | undefined>;

function Feedback({ state }: { state: StudentFormState | undefined }) { return <>{state?.error && <p className="student-error">{state.error}</p>}{state?.success && <p className="student-success">{state.success}</p>}</>; }
function Field({ label, name, type = "text", defaultValue, required = false, placeholder }: { label: string; name: string; type?: string; defaultValue?: string | null; required?: boolean; placeholder?: string }) { return <label className="student-field">{label}<input name={name} type={type} defaultValue={defaultValue ?? ""} required={required} placeholder={placeholder} /></label>; }
function SelectField({ label, name, options, defaultValue, required = false }: { label: string; name: string; options: Array<{ value: string; label: string }>; defaultValue?: string | null; required?: boolean }) { return <label className="student-field">{label}<select name={name} defaultValue={defaultValue ?? ""} required={required}><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }

function ReadonlyDetails({ values }: { values: Array<[string, string | null | undefined]> }) {
  return <dl className="student-readonly-grid">{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value?.trim() || "—"}</dd></div>)}</dl>;
}

const genderOptions = [{ value: "female", label: "Female" }, { value: "male", label: "Male" }, { value: "non_binary", label: "Non-binary" }, { value: "undisclosed", label: "Prefer not to say" }];
const bloodOptions = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((value) => ({ value, label: value }));

export function StudentForm({ student, editable }: { student: StudentRecord; editable: boolean }) {
  const [state, action] = useActionState(updateStudent, undefined);
  const identity = [
    ["Admission number", student.admission_number],
    ["Student ID", student.student_identifier],
    ["First name", student.first_name],
    ["Middle name", student.middle_name],
    ["Last name", student.last_name],
    ["Date of birth", student.date_of_birth],
    ["Gender", student.gender],
    ["Blood group", student.blood_group],
    ["Nationality", student.nationality],
    ["Status", student.status],
  ] as Array<[string, string | null | undefined]>;
  const contact = [
    ["Student phone", student.phone],
    ["Student email", student.email],
    ["Address", student.address],
    ["Guardian / emergency contact", student.emergency_contact_name],
    ["Guardian / emergency phone", student.emergency_contact_phone],
    ["Relationship to student", student.emergency_contact_relationship],
  ] as Array<[string, string | null | undefined]>;
  const additional = [
    ["Admission date", student.admission_date],
    ["Previous school", student.previous_school],
    ["Medical notes", student.medical_notes],
  ] as Array<[string, string | null | undefined]>;

  if (!editable) {
    return <div className="student-form student-form--readonly">
      <section className="student-form-section"><h3>Identity</h3><ReadonlyDetails values={identity} /></section>
      <section className="student-form-section"><h3>Contact & guardian</h3><ReadonlyDetails values={contact} /></section>
      <section className="student-form-section"><h3>Additional information</h3><ReadonlyDetails values={additional} /></section>
      <p className="student-form-note">Student information is read-only. Only a school admin or principal can edit and save these details.</p>
    </div>;
  }

  return (
    <form action={action} className="student-form">
      <Feedback state={state} />
      <input type="hidden" name="id" value={String(student.id)} />
      <div className="student-form-section"><h3>Identity</h3><div className="student-form-grid">
        <p className="student-field"><span>Admission number (permanent)</span><strong>{student.admission_number}</strong></p>
        <p className="student-field"><span>Student ID (class/section code)</span><strong>{student.student_identifier}</strong></p>
        <Field label="First name" name="firstName" defaultValue={student.first_name} required />
        <Field label="Middle name" name="middleName" defaultValue={student.middle_name} />
        <Field label="Last name" name="lastName" defaultValue={student.last_name} required />
        <Field label="Date of birth" name="dateOfBirth" type="date" defaultValue={student.date_of_birth} />
        <SelectField label="Gender" name="gender" options={genderOptions} defaultValue={student.gender} />
        <SelectField label="Blood group" name="bloodGroup" options={bloodOptions} defaultValue={student.blood_group} />
        <Field label="Nationality" name="nationality" defaultValue={student.nationality} />
        <SelectField label="Status" name="status" options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "archived", label: "Archived" }]} defaultValue={student.status ?? "active"} />
      </div></div>
      <div className="student-form-section"><h3>Contact & guardian</h3><div className="student-form-grid">
        <Field label="Student phone" name="phone" defaultValue={student.phone} />
        <Field label="Student email" name="email" type="email" defaultValue={student.email} />
        <Field label="Guardian name" name="emergencyContactName" defaultValue={student.emergency_contact_name} />
        <Field label="Guardian phone" name="emergencyContactPhone" defaultValue={student.emergency_contact_phone} />
        <SelectField label="Relationship to student" name="emergencyContactRelationship" options={[{ value: "father", label: "Father" }, { value: "mother", label: "Mother" }, { value: "guardian", label: "Guardian" }, { value: "other", label: "Other" }]} defaultValue={student.emergency_contact_relationship ?? "guardian"} />
        <label className="student-field student-field-wide">Address<textarea name="address" defaultValue={student.address ?? ""} rows={3} /></label>
      </div></div>
      <div className="student-form-section"><h3>Additional information</h3><div className="student-form-grid">
        <Field label="Admission date" name="admissionDate" type="date" defaultValue={student.admission_date} />
        <Field label="Previous school" name="previousSchool" defaultValue={student.previous_school} />
        <label className="student-field student-field-wide">Medical notes<textarea name="medicalNotes" defaultValue={student.medical_notes ?? ""} rows={3} /></label>
      </div></div>
      <SubmitButton>Save student details</SubmitButton>
    </form>
  );
}

export function ArchiveStudentForm({ id }: { id: string }) { const [state, action] = useActionState(archiveStudent, undefined); return <form action={action} className="student-archive-form"><input type="hidden" name="id" value={id} /><button type="submit">Archive student</button>{state?.error && <span className="student-error">{state.error}</span>}</form>; }

export function DocumentForm({ studentId }: { studentId: string }) { const [state, action] = useActionState(addStudentDocument, undefined); return <form action={action} className="student-form"><Feedback state={state} /><input type="hidden" name="studentId" value={studentId} /><div className="student-form-grid"><Field label="Document type" name="documentType" placeholder="Birth certificate" required /><Field label="Document name" name="documentName" placeholder="Birth certificate 2026" required /></div><p className="student-form-note">Files will be uploaded to Supabase Storage in the documents phase. This records metadata only.</p><SubmitButton>Add document metadata</SubmitButton></form>; }