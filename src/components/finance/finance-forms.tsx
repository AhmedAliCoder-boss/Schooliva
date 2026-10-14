"use client";

import { useActionState, useMemo, useState } from "react";
import { saveExpense, saveFeeStructure, saveInvoice, savePayment } from "@/app/actions/finance";
import { SubmitButton } from "@/components/auth/submit-button";
import { SearchableOptionSelect, SearchableStudentSelect, type SearchableStudentOption } from "@/components/finance/searchable-student-select";
import { formatCurrency } from "@/lib/format/currency";
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
  return <form action={action} className="student-form"><Feedback state={state} /><div className="student-form-grid"><Select label="Academic session" name="academicSessionId" options={sessions} /><label className="student-field">Class<select name="classId" required defaultValue=""><option value="">Select class</option><option value="all">All classes</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="student-field">Fee type<select name="feeType" required><option value="">Select fee type</option><option value="admission">Admission</option><option value="tuition">Tuition</option><option value="examination">Examination</option><option value="transport">Transport</option><option value="library">Library</option><option value="laboratory">Laboratory</option><option value="activity">Activity</option><option value="other">Other</option></select></label><label className="student-field">Amount<input name="amount" type="number" min="0" step="0.01" required /></label><label className="student-field">Frequency<select name="frequency" required><option value="monthly">Monthly</option><option value="term">Term</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option><option value="one_time">One time</option></select></label><label className="student-field">Due day<input name="dueDay" type="number" min="1" max="31" required /></label><label className="student-field">Optional<select name="isOptional"><option value="false">Mandatory</option><option value="true">Optional</option></select></label><label className="student-field">Active<select name="isActive"><option value="true">Active</option><option value="false">Inactive</option></select></label></div><SubmitButton disabled={!classes.length || !sessions.length}>Add fee structure</SubmitButton></form>;
}

export function InvoiceForm({ sessions, students, feeStructures, defaultSessionId }: { sessions: Option[]; students: SearchableStudentOption[]; feeStructures: Option[]; defaultSessionId: string }) {
  const [state, action] = useActionState(saveInvoice, undefined);
  return <form action={action} className="student-form"><Feedback state={state} /><div className="student-form-grid"><Select label="Academic session" name="academicSessionId" options={sessions} defaultValue={defaultSessionId} /><SearchableStudentSelect students={students} /><label className="student-field">Due date<input name="dueDate" type="date" required /></label><fieldset className="student-field finance-fee-options"><legend>Fee items</legend>{feeStructures.length ? feeStructures.map((item) => <label key={item.id}><input type="checkbox" name="feeStructureIds" value={item.id} /><span>{item.name}</span></label>) : <p>Add an active fee structure before creating invoices.</p>}</fieldset><label className="student-field">Notes<textarea name="notes" rows={3} /></label></div><SubmitButton>Create invoice</SubmitButton></form>;
}

type PaymentInvoice = SearchableStudentOption & {
  invoiceNumber: string;
  studentName: string;
  studentIdentifier: string;
  admissionNumber: string;
  dueDate: string;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  items: { description: string; amount: number; optional: boolean }[];
};

function todayInSchoolTimeZone() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function PaymentForm({ invoices }: { invoices: PaymentInvoice[] }) {
  const [state, action] = useActionState(savePayment, undefined);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null;
  const receivedAmount = Number(amount) || 0;
  const balanceAfterPayment = selectedInvoice
    ? Math.max(selectedInvoice.remainingAmount - receivedAmount, 0)
    : 0;
  const hasOverpayment = Boolean(selectedInvoice && receivedAmount > selectedInvoice.remainingAmount);
  const projectedStatus = balanceAfterPayment === 0 && receivedAmount > 0
    ? "Paid in full"
    : receivedAmount > 0
      ? "Partially paid"
      : "Awaiting payment";
  const isInvoiceOverdue = Boolean(selectedInvoice
    && selectedInvoice.remainingAmount > 0
    && selectedInvoice.dueDate < todayInSchoolTimeZone());

  const paymentDisabled = useMemo(
    () => !selectedInvoice || receivedAmount <= 0 || hasOverpayment,
    [hasOverpayment, receivedAmount, selectedInvoice],
  );

  return <form action={action} className="student-form">
    <Feedback state={state} />
    <div className="student-form-grid">
      <SearchableOptionSelect
        options={invoices}
        label="Invoice"
        name="invoiceId"
        placeholder="Search invoice number or student name"
        onSelectionChange={(invoiceId) => {
          setSelectedInvoiceId(invoiceId);
          setAmount("");
        }}
      />
      {selectedInvoice && <section className="payment-invoice-details" aria-labelledby="payment-invoice-details-title">
        <header>
          <div><span>Selected invoice</span><h3 id="payment-invoice-details-title">{selectedInvoice.invoiceNumber}</h3></div>
          <span className={`status-pill ${isInvoiceOverdue ? "overdue" : selectedInvoice.status}`}>{isInvoiceOverdue ? "overdue" : selectedInvoice.status.replaceAll("_", " ")}</span>
        </header>
        <dl>
          <div><dt>Student</dt><dd>{selectedInvoice.studentName}</dd></div>
          <div><dt>Student ID</dt><dd>{selectedInvoice.studentIdentifier || "—"}</dd></div>
          <div><dt>Admission no.</dt><dd>{selectedInvoice.admissionNumber || "—"}</dd></div>
          <div><dt>Due date</dt><dd>{selectedInvoice.dueDate}</dd></div>
          <div><dt>Invoice total</dt><dd>{formatCurrency(selectedInvoice.total)}</dd></div>
          <div><dt>Paid so far</dt><dd>{formatCurrency(selectedInvoice.paidAmount)}</dd></div>
          <div className="payment-invoice-details__balance"><dt>Balance due</dt><dd>{formatCurrency(selectedInvoice.remainingAmount)}</dd></div>
        </dl>
        <div className="payment-invoice-details__items">
          <strong>Invoice items</strong>
          {selectedInvoice.items.length ? <ul>{selectedInvoice.items.map((item, index) => <li key={`${item.description}-${index}`}>
            <span>{item.description}{item.optional ? " (optional)" : ""}</span><strong>{formatCurrency(item.amount)}</strong>
          </li>)}</ul> : <p>No line item details are recorded for this invoice.</p>}
        </div>
      </section>}
      <label className="student-field">Amount received
        <input
          name="amount"
          type="number"
          min="0.01"
          max={selectedInvoice?.remainingAmount}
          step="0.01"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        {selectedInvoice && <small>Outstanding: {formatCurrency(selectedInvoice.remainingAmount)}</small>}
      </label>
      {selectedInvoice && <div className={`payment-tally${hasOverpayment ? " payment-tally--error" : ""}`} aria-live="polite">
        <div><span>Received now</span><strong>{formatCurrency(receivedAmount)}</strong></div>
        <div><span>Balance after payment</span><strong>{formatCurrency(balanceAfterPayment)}</strong></div>
        <div><span>Payment result</span><strong>{hasOverpayment ? "Amount exceeds balance" : projectedStatus}</strong></div>
      </div>}
      <label className="student-field">Payment method<select name="paymentMethod" required><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="other">Other</option></select></label>
      <label className="student-field">Payment date<input name="paymentDate" type="date" required /></label>
      <label className="student-field">Notes<textarea name="notes" rows={3} /></label>
    </div>
    {hasOverpayment && <p className="student-error" role="alert">Received amount cannot exceed the invoice balance due.</p>}
    <SubmitButton disabled={paymentDisabled}>Record payment</SubmitButton>
  </form>;
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
