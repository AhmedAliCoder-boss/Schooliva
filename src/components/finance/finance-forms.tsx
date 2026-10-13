"use client";

import { useActionState } from "react";
import { saveExpense, saveFeeStructure, saveInvoice, savePayment } from "@/app/actions/finance";
import { SubmitButton } from "@/components/auth/submit-button";
import type { FinanceFormState } from "@/lib/finance/schemas";

type Option = { id: string; name: string };

function Feedback({ state }: { state: FinanceFormState | undefined }) {
  return <>{state?.error && <p className="student-error">{state.error}</p>}{state?.success && <p className="student-success">{state.success}</p>}</>;
}

function Select({ label, name, options, required = true, defaultValue }: { label: string; name: string; options: Option[]; required?: boolean; defaultValue?: string }) {
  return <label className="student-field">{label}<select name={name} required={required} defaultValue={defaultValue ?? ""}><option value="">Select {label.toLowerCase()}</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}

export function FeeStructureForm({ sessions, classes }: { sessions: Option[]; classes: Option[] }) {
  const [state, action] = useActionState(saveFeeStructure, undefined);
  return <form action={action} className="student-form"><Feedback state={state} /><div className="student-form-grid"><Select label="Academic session" name="academicSessionId" options={sessions} /><Select label="Class" name="classId" options={classes} /><label className="student-field">Fee type<select name="feeType" required><option value="">Select fee type</option><option value="admission">Admission</option><option value="tuition">Tuition</option><option value="examination">Examination</option><option value="transport">Transport</option><option value="library">Library</option><option value="laboratory">Laboratory</option><option value="activity">Activity</option><option value="other">Other</option></select></label><label className="student-field">Amount<input name="amount" type="number" min="0" step="0.01" required /></label><label className="student-field">Frequency<select name="frequency" required><option value="monthly">Monthly</option><option value="term">Term</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option><option value="one_time">One time</option></select></label><label className="student-field">Due day<input name="dueDay" type="number" min="1" max="31" required /></label><label className="student-field">Optional<select name="isOptional"><option value="false">Mandatory</option><option value="true">Optional</option></select></label><label className="student-field">Active<select name="isActive"><option value="true">Active</option><option value="false">Inactive</option></select></label></div><SubmitButton>Add fee structure</SubmitButton></form>;
}

export function InvoiceForm({ sessions, students, feeStructures, defaultSessionId }: { sessions: Option[]; students: Option[]; feeStructures: Option[]; defaultSessionId: string }) {
  const [state, action] = useActionState(saveInvoice, undefined);
  return <form action={action} className="student-form"><Feedback state={state} /><div className="student-form-grid"><Select label="Academic session" name="academicSessionId" options={sessions} defaultValue={defaultSessionId} /><Select label="Student" name="studentId" options={students} /><label className="student-field">Due date<input name="dueDate" type="date" required /></label><fieldset className="student-field finance-fee-options"><legend>Fee items</legend>{feeStructures.length ? feeStructures.map((item) => <label key={item.id}><input type="checkbox" name="feeStructureIds" value={item.id} /><span>{item.name}</span></label>) : <p>Add an active fee structure before creating invoices.</p>}</fieldset><label className="student-field">Notes<textarea name="notes" rows={3} /></label></div><SubmitButton>Create invoice</SubmitButton></form>;
}

export function PaymentForm({ invoices }: { invoices: Option[] }) {
  const [state, action] = useActionState(savePayment, undefined);
  return <form action={action} className="student-form"><Feedback state={state} /><div className="student-form-grid"><Select label="Invoice" name="invoiceId" options={invoices} /><label className="student-field">Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label><label className="student-field">Payment method<select name="paymentMethod" required><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="other">Other</option></select></label><label className="student-field">Payment date<input name="paymentDate" type="date" required /></label><label className="student-field">Notes<textarea name="notes" rows={3} /></label></div><SubmitButton>Record payment</SubmitButton></form>;
}

export function ExpenseForm() {
  const [state, action] = useActionState(saveExpense, undefined);
  return <form action={action} className="student-form">
    <Feedback state={state} />
    <div className="student-form-grid">
      <label className="student-field">Category<select name="category" required><option value="">Select category</option><option value="salary">Salary</option><option value="utilities">Utilities</option><option value="supplies">Supplies</option><option value="maintenance">Maintenance</option><option value="transport">Transport</option><option value="other">Other</option></select></label>
      <label className="student-field">Description<input name="description" maxLength={160} required /></label>
      <label className="student-field">Vendor / payee<input name="vendor" maxLength={120} /></label>
      <label className="student-field">Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label>
      <label className="student-field">Payment method<select name="paymentMethod" required><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="other">Other</option></select></label>
      <label className="student-field">Expense date<input name="expenseDate" type="date" required /></label>
      <label className="student-field">Reference<input name="reference" maxLength={80} /></label>
      <label className="student-field">Notes<textarea name="notes" rows={3} maxLength={500} /></label>
    </div>
    <SubmitButton>Save expense</SubmitButton>
  </form>;
}
