"use client";

import { useActionState } from "react";
import { saveFeeStructure, saveInvoice, savePayment } from "@/app/actions/finance";
import { SubmitButton } from "@/components/auth/submit-button";
import type { FinanceFormState } from "@/lib/finance/schemas";

type Option = { id: string; name: string };

function Feedback({ state }: { state: FinanceFormState | undefined }) {
  return <>{state?.error && <p className="student-error">{state.error}</p>}{state?.success && <p className="student-success">{state.success}</p>}</>;
}

function Select({ label, name, options, required = true }: { label: string; name: string; options: Option[]; required?: boolean }) {
  return <label className="student-field">{label}<select name={name} required={required}><option value="">Select {label.toLowerCase()}</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}

export function FeeStructureForm({ sessions, classes }: { sessions: Option[]; classes: Option[] }) {
  const [state, action] = useActionState(saveFeeStructure, undefined);
  return <form action={action} className="student-form"><Feedback state={state} /><div className="student-form-grid"><Select label="Academic session" name="academicSessionId" options={sessions} /><Select label="Class" name="classId" options={classes} /><label className="student-field">Fee type<select name="feeType" required><option value="">Select fee type</option><option value="admission">Admission</option><option value="tuition">Tuition</option><option value="examination">Examination</option><option value="transport">Transport</option><option value="library">Library</option><option value="laboratory">Laboratory</option><option value="activity">Activity</option><option value="other">Other</option></select></label><label className="student-field">Amount<input name="amount" type="number" min="0" step="0.01" required /></label><label className="student-field">Frequency<select name="frequency" required><option value="monthly">Monthly</option><option value="term">Term</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option><option value="one_time">One time</option></select></label><label className="student-field">Due day<input name="dueDay" type="number" min="1" max="31" required /></label><label className="student-field">Optional<select name="isOptional"><option value="false">Mandatory</option><option value="true">Optional</option></select></label><label className="student-field">Active<select name="isActive"><option value="true">Active</option><option value="false">Inactive</option></select></label></div><SubmitButton>Add fee structure</SubmitButton></form>;
}

export function InvoiceForm({ sessions, students, feeStructures }: { sessions: Option[]; students: Option[]; feeStructures: Option[] }) {
  const [state, action] = useActionState(saveInvoice, undefined);
  return <form action={action} className="student-form"><Feedback state={state} /><div className="student-form-grid"><Select label="Academic session" name="academicSessionId" options={sessions} /><Select label="Student" name="studentId" options={students} /><label className="student-field">Due date<input name="dueDate" type="date" required /></label><label className="student-field">Items<select name="feeStructureIds" multiple><option value="">Select items</option>{feeStructures.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="student-field">Notes<textarea name="notes" rows={3} /></label></div><SubmitButton>Create invoice</SubmitButton></form>;
}

export function PaymentForm({ invoices }: { invoices: Option[] }) {
  const [state, action] = useActionState(savePayment, undefined);
  return <form action={action} className="student-form"><Feedback state={state} /><div className="student-form-grid"><Select label="Invoice" name="invoiceId" options={invoices} /><label className="student-field">Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label><label className="student-field">Payment method<select name="paymentMethod" required><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="other">Other</option></select></label><label className="student-field">Payment date<input name="paymentDate" type="date" required /></label><label className="student-field">Notes<textarea name="notes" rows={3} /></label></div><SubmitButton>Record payment</SubmitButton></form>;
}
