"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { generateScheduledInvoices, saveManagementInvoice, saveStudentInvoiceSchedule, setStudentInvoiceScheduleActive } from "@/app/actions/finance";
import { SubmitButton } from "@/components/auth/submit-button";
import { SearchableStudentSelect, type SearchableStudentOption } from "@/components/finance/searchable-student-select";
import { formatCurrency } from "@/lib/format/currency";
import type { FinanceFormState } from "@/lib/finance/schemas";

type Option = { id: string; name: string };
type FeeOption = Option & { sessionId: string; classId: string };
export type StudentInvoiceScheduleRow = {
  id: string;
  studentName: string;
  frequency: string;
  nextInvoiceDate: string;
  isActive: boolean;
};
export type ManagementInvoiceRow = {
  id: string;
  invoiceNumber: string;
  recipientName: string;
  dueDate: string;
  total: number;
  status: string;
};

function Feedback({ state }: { state: FinanceFormState | undefined }) {
  return <>{state?.error && <p className="student-error" role="alert">{state.error}</p>}{state?.success && <p className="student-success" role="status">{state.success}</p>}</>;
}

export function StudentInvoiceScheduleForm({
  students,
  sessions,
  feeStructures,
}: {
  students: SearchableStudentOption[];
  sessions: Option[];
  feeStructures: FeeOption[];
}) {
  const [state, action] = useActionState(saveStudentInvoiceSchedule, undefined);
  return <form action={action} className="student-form">
    <Feedback state={state} />
    <p className="invoice-automation__hint">Invoices start on the student&apos;s admission date. Any periods already due are generated during setup; future runs keep the same joining-day anchor.</p>
    <div className="student-form-grid">
      <SearchableStudentSelect students={students} />
      <label className="student-field">Academic session<select name="academicSessionId" required defaultValue=""><option value="">Select session</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label>
      <label className="student-field">Generate invoices<select name="frequency" required defaultValue="monthly"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></label>
      <fieldset className="student-field finance-fee-options">
        <legend>Recurring fee items</legend>
        {feeStructures.length ? feeStructures.map((item) => <label key={item.id}>
          <input type="checkbox" name="feeStructureIds" value={item.id} />
          <span>{item.name}</span>
        </label>) : <p>Add active recurring fee structures first.</p>}
      </fieldset>
    </div>
    <SubmitButton disabled={!students.length || !sessions.length || !feeStructures.length}>Activate schedule and generate due invoices</SubmitButton>
  </form>;
}

function ScheduleStatusForm({ schedule }: { schedule: StudentInvoiceScheduleRow }) {
  const [state, action] = useActionState(setStudentInvoiceScheduleActive, undefined);
  return <form action={action} className="invoice-automation__status">
    <input type="hidden" name="scheduleId" value={schedule.id} />
    <input type="hidden" name="isActive" value={String(!schedule.isActive)} />
    <button type="submit">{schedule.isActive ? "Pause" : "Resume"}</button>
    <Feedback state={state} />
  </form>;
}

export function ScheduledInvoicePanel({
  students,
  sessions,
  feeStructures,
  schedules,
  canManage,
}: {
  students: Option[];
  sessions: Option[];
  feeStructures: FeeOption[];
  schedules: StudentInvoiceScheduleRow[];
  canManage: boolean;
}) {
  const [state, action] = useActionState(generateScheduledInvoices, undefined);
  return <section className="finance-work-card invoice-automation" aria-labelledby="scheduled-invoice-title">
    <header className="finance-work-card__heading">
      <div><span className="dashboard-panel-kicker">Recurring billing</span><h2 id="scheduled-invoice-title">Scheduled invoices</h2><p>Daily automation generates all due invoices, anchored to each student&apos;s admission date.</p></div>
      {canManage && <form action={action}><SubmitButton>Generate due invoices</SubmitButton><Feedback state={state} /></form>}
    </header>
    {canManage && <details className="invoice-automation__setup">
      <summary>Set up a student schedule</summary>
      <StudentInvoiceScheduleForm students={students} sessions={sessions} feeStructures={feeStructures} />
    </details>}
    <div className="invoice-automation__schedules">
      {schedules.length ? schedules.map((schedule) => <article key={schedule.id}>
        <div><strong>{schedule.studentName}</strong><span>{schedule.frequency} · next invoice {schedule.nextInvoiceDate}</span></div>
        <span className={`status-pill ${schedule.isActive ? "active" : "cancelled"}`}>{schedule.isActive ? "active" : "paused"}</span>
        {canManage && <ScheduleStatusForm schedule={schedule} />}
      </article>) : <p className="invoice-automation__empty">No student invoice schedules yet.</p>}
    </div>
  </section>;
}

type LineItem = { id: number };

export function ManagementInvoiceForm() {
  const [state, action] = useActionState(saveManagementInvoice, undefined);
  const [items, setItems] = useState<LineItem[]>([{ id: 0 }]);
  return <form action={action} className="student-form">
    <Feedback state={state} />
    <div className="student-form-grid">
      <label className="student-field">Recipient / organization<input name="recipientName" required minLength={2} maxLength={160} /></label>
      <label className="student-field">Email<input name="recipientEmail" type="email" maxLength={254} /></label>
      <label className="student-field">Phone<input name="recipientPhone" type="tel" maxLength={40} /></label>
      <label className="student-field">Due date<input name="dueDate" type="date" required /></label>
    </div>
    <fieldset className="student-field management-invoice-items">
      <legend>Invoice items</legend>
      {items.map((item, index) => <div className="management-invoice-items__row" key={item.id}>
        <label>Description<input name="itemDescription" required minLength={2} maxLength={200} /></label>
        <label>Quantity<input name="itemQuantity" type="number" min="0.01" step="0.01" defaultValue="1" required /></label>
        <label>Unit price<input name="itemUnitPrice" type="number" min="0" step="0.01" required /></label>
        {items.length > 1 && <button type="button" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} aria-label={`Remove item ${index + 1}`}>Remove</button>}
      </div>)}
      {items.length < 10 && <button type="button" onClick={() => setItems((current) => [...current, { id: Math.max(...current.map((item) => item.id)) + 1 }])}>Add item</button>}
    </fieldset>
    <label className="student-field">Notes<textarea name="notes" rows={3} maxLength={1000} /></label>
    <SubmitButton>Create management invoice</SubmitButton>
  </form>;
}

export function ManagementInvoiceRegister({ invoices }: { invoices: ManagementInvoiceRow[] }) {
  return <section className="finance-work-card management-invoice-register" aria-labelledby="management-invoice-title">
    <header className="finance-work-card__heading"><div><span className="dashboard-panel-kicker">Separate register</span><h2 id="management-invoice-title">Management invoices</h2><p>General invoices for non-student recipients.</p></div><span>{invoices.length} invoices</span></header>
    <div className="student-table-wrap"><table className="student-table">
      <thead><tr><th>Invoice</th><th>Recipient</th><th>Due date</th><th>Total</th><th>Status</th><th>Document</th></tr></thead>
      <tbody>{invoices.length ? invoices.map((invoice) => <tr key={invoice.id}>
        <td><strong>{invoice.invoiceNumber}</strong></td><td>{invoice.recipientName}</td><td>{invoice.dueDate}</td><td>{formatCurrency(invoice.total)}</td>
        <td><span className={`status-pill ${invoice.status}`}>{invoice.status.replaceAll("_", " ")}</span></td>
        <td><Link className="school-document-link" href={`/finance/print/management-invoice/${invoice.id}`}>Print / PDF</Link></td>
      </tr>) : <tr><td colSpan={6}><div className="student-empty"><h3>No management invoices</h3><p>Invoices for external recipients will appear here.</p></div></td></tr>}</tbody>
    </table></div>
  </section>;
}
