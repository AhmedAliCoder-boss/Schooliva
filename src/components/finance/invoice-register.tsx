"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatCurrency } from "@/lib/format/currency";
import { summarizeInvoiceStatuses, type InvoiceStatistics } from "@/lib/finance/invoice-statistics";

export type InvoiceRegisterRow = {
  id: string;
  studentId: string;
  invoiceNumber: string;
  studentName: string;
  admissionNumber: string;
  studentIdentifier: string;
  className: string;
  sectionName: string;
  sessionId: string;
  sessionName: string;
  dueDate: string;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  createdAt: string;
};

export type InvoiceRegisterSession = { id: string; name: string };

type StatusFilter = "all" | "unpaid" | "partially_paid" | "paid" | "overdue" | "cancelled";
type SortOrder = "newest" | "oldest" | "balance_high" | "balance_low";

function isOverdue(invoice: InvoiceRegisterRow, today: string) {
  return invoice.status === "overdue"
    || (invoice.status !== "paid" && invoice.status !== "cancelled" && invoice.remainingAmount > 0 && invoice.dueDate < today);
}

function matchesStatus(invoice: InvoiceRegisterRow, status: StatusFilter, today: string) {
  if (status === "all") return true;
  if (status === "overdue") return isOverdue(invoice, today);
  return invoice.status === status;
}

function InvoiceTable({ invoices, today }: { invoices: InvoiceRegisterRow[]; today: string }) {
  return <div className="student-table-wrap">
    <table className="student-table invoice-register__table">
      <thead><tr><th>Invoice</th><th>Student</th><th>Session</th><th>Due date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th className="no-print">Document</th></tr></thead>
      <tbody>{invoices.map((invoice) => {
        const overdue = isOverdue(invoice, today);
        return <tr key={invoice.id}>
          <td><strong>{invoice.invoiceNumber}</strong></td>
          <td><strong>{invoice.studentName}</strong><small>{invoice.admissionNumber ? `Admission: ${invoice.admissionNumber}` : invoice.studentIdentifier || "Student ID unavailable"}</small></td>
          <td>{invoice.sessionName || "—"}</td>
          <td><span className={overdue ? "invoice-register__overdue" : ""}>{invoice.dueDate}</span>{overdue && <small className="invoice-register__overdue-note">Past due</small>}</td>
          <td>{formatCurrency(invoice.total)}</td>
          <td>{formatCurrency(invoice.paidAmount)}</td>
          <td><strong className={invoice.remainingAmount > 0 ? "invoice-register__balance-due" : ""}>{formatCurrency(invoice.remainingAmount)}</strong></td>
          <td><span className={`status-pill ${invoice.status}`}>{invoice.status.replaceAll("_", " ")}</span></td>
          <td className="no-print"><Link className="school-document-link" href={`/finance/print/invoice/${invoice.id}`}>Print / PDF</Link></td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

function StatusStatistics({ statistics }: { statistics: InvoiceStatistics }) {
  return <span className="results-group-statistics invoice-register__statistics" aria-label="Invoice status statistics">
    <span className="results-group-stat invoice-register__stat--paid">Paid {statistics.paid.count} · {formatCurrency(statistics.paid.amount)} collected</span>
    <span className="results-group-stat invoice-register__stat--pending">Pending {statistics.pending.count} · {formatCurrency(statistics.pending.amount)} due</span>
    <span className="results-group-stat invoice-register__stat--partial">Partially paid {statistics.partiallyPaid.count} · {formatCurrency(statistics.partiallyPaid.amount)} due</span>
  </span>;
}

function GroupedInvoiceRegister({ invoices, today }: { invoices: InvoiceRegisterRow[]; today: string }) {
  const classes = new Map<string, Map<string, Map<string, InvoiceRegisterRow[]>>>();
  for (const invoice of invoices) {
    const className = invoice.className || "Unassigned class";
    const sectionName = invoice.sectionName || "Unassigned section";
    const classSections = classes.get(className) ?? new Map<string, Map<string, InvoiceRegisterRow[]>>();
    const sectionStudents = classSections.get(sectionName) ?? new Map<string, InvoiceRegisterRow[]>();
    const studentKey = invoice.studentId;
    const studentInvoices = sectionStudents.get(studentKey) ?? [];
    studentInvoices.push(invoice);
    sectionStudents.set(studentKey, studentInvoices);
    classSections.set(sectionName, sectionStudents);
    classes.set(className, classSections);
  }
  return <div className="invoice-register__groups">
    {classes.size ? [...classes.entries()].map(([className, sections]) => {
      const classInvoices = [...sections.values()].flatMap((students) => [...students.values()].flat());
      const classStatistics = summarizeInvoiceStatuses(classInvoices);
      return <details className="results-class-group invoice-register__class" key={className}>
      <summary>
        <span className="results-group-summary">
          <span><strong>{className}</strong><small>{classInvoices.length} invoices · {sections.size} sections</small></span>
          <StatusStatistics statistics={classStatistics} />
        </span>
        <span className="exam-content-drawer__toggle" aria-hidden="true">⌄</span>
      </summary>
      <div className="results-section-groups">{[...sections.entries()].map(([sectionName, students]) => {
        const sectionInvoices = [...students.values()].flat();
        const sectionStatistics = summarizeInvoiceStatuses(sectionInvoices);
        return <details className="results-section-group invoice-register__section" key={sectionName}>
        <summary>
          <span className="results-group-summary">
            <span><strong>{sectionName}</strong><small>{students.size} students · {sectionInvoices.length} invoices</small></span>
            <StatusStatistics statistics={sectionStatistics} />
          </span>
          <span className="exam-content-drawer__toggle" aria-hidden="true">⌄</span>
        </summary>
        {[...students.values()].map((rows) => <details className="invoice-register__student" key={rows[0].studentId}>
          <summary><strong>{rows[0].studentName}</strong><span>{rows[0].studentIdentifier || rows[0].admissionNumber || "Student ID unavailable"}</span><span>{rows.length} invoices</span></summary>
          <InvoiceTable invoices={rows} today={today} />
        </details>)}
      </details>;
      })}</div>
    </details>;
    }) : <div className="student-empty"><h3>No matching invoices</h3><p>Try a different search or clear some filters.</p></div>}
  </div>;
}

export function InvoiceRegister({ invoices, sessions, today }: {
  invoices: InvoiceRegisterRow[];
  sessions: InvoiceRegisterSession[];
  today: string;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sessionId, setSessionId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [openBalanceOnly, setOpenBalanceOnly] = useState(false);
  const [sort, setSort] = useState<SortOrder>("newest");

  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return invoices.filter((invoice) => {
      const searchable = `${invoice.invoiceNumber} ${invoice.studentName} ${invoice.admissionNumber} ${invoice.studentIdentifier}`.toLocaleLowerCase();
      return (!term || searchable.includes(term))
        && matchesStatus(invoice, status, today)
        && (!sessionId || invoice.sessionId === sessionId)
        && (!fromDate || invoice.dueDate >= fromDate)
        && (!toDate || invoice.dueDate <= toDate)
        && (!openBalanceOnly || (invoice.remainingAmount > 0 && invoice.status !== "cancelled"));
    }).sort((left, right) => {
      if (sort === "balance_high") return right.remainingAmount - left.remainingAmount;
      if (sort === "balance_low") return left.remainingAmount - right.remainingAmount;
      return sort === "newest"
        ? right.createdAt.localeCompare(left.createdAt)
        : left.createdAt.localeCompare(right.createdAt);
    });
  }, [fromDate, invoices, openBalanceOnly, search, sessionId, sort, status, today, toDate]);

  const summary = useMemo(() => filteredInvoices.reduce((totals, invoice) => ({
    total: totals.total + invoice.total,
    paid: totals.paid + invoice.paidAmount,
    outstanding: totals.outstanding + (invoice.status === "cancelled" ? 0 : invoice.remainingAmount),
  }), { total: 0, paid: 0, outstanding: 0 }), [filteredInvoices]);
  const statusCounts = useMemo(() => ({
    all: invoices.length,
    unpaid: invoices.filter((invoice) => invoice.status === "unpaid").length,
    partially_paid: invoices.filter((invoice) => invoice.status === "partially_paid").length,
    overdue: invoices.filter((invoice) => isOverdue(invoice, today)).length,
    paid: invoices.filter((invoice) => invoice.status === "paid").length,
    cancelled: invoices.filter((invoice) => invoice.status === "cancelled").length,
  }), [invoices, today]);
  const hasFilters = Boolean(search || status !== "all" || sessionId || fromDate || toDate || openBalanceOnly);

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setSessionId("");
    setFromDate("");
    setToDate("");
    setOpenBalanceOnly(false);
  }

  return <section className="finance-work-card finance-work-card--records invoice-register" aria-labelledby="invoice-list-title">
    <header className="finance-work-card__heading">
      <div><span className="dashboard-panel-kicker">Invoice register</span><h2 id="invoice-list-title">Student invoices</h2><p>Showing {filteredInvoices.length} of {invoices.length} invoices</p></div>
      <button className="invoice-register__clear" type="button" onClick={clearFilters} disabled={!hasFilters}>Clear filters</button>
    </header>
    <div className="invoice-register__summary" aria-label="Summary of filtered invoices">
      <article><span>Filtered total</span><strong>{formatCurrency(summary.total)}</strong></article>
      <article><span>Collected</span><strong>{formatCurrency(summary.paid)}</strong></article>
      <article><span>Outstanding balance</span><strong>{formatCurrency(summary.outstanding)}</strong></article>
    </div>
    <div className="invoice-register__quick-filters" role="group" aria-label="Filter invoices by status">
      {([
        ["all", "All invoices"],
        ["unpaid", "Unpaid"],
        ["partially_paid", "Part paid"],
        ["overdue", "Overdue"],
        ["paid", "Paid"],
        ["cancelled", "Cancelled"],
      ] as const).map(([value, label]) => <button
        key={value}
        type="button"
        className={status === value ? "active" : ""}
        aria-pressed={status === value}
        onClick={() => setStatus(value)}
      >{label}<span>{statusCounts[value]}</span></button>)}
    </div>
    <div className="invoice-register__filters" role="search" aria-label="Search and filter invoices">
      <label className="invoice-register__search"><span>Search</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Invoice number, student, admission number or ID" /></label>
      <label><span>Academic session</span><select value={sessionId} onChange={(event) => setSessionId(event.target.value)}><option value="">All sessions</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></label>
      <label><span>Due from</span><input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></label>
      <label><span>Due to</span><input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label>
      <label><span>Sort by</span><select value={sort} onChange={(event) => {
        const value = event.target.value;
        if (value === "newest" || value === "oldest" || value === "balance_high" || value === "balance_low") setSort(value);
      }}><option value="newest">Recently created</option><option value="oldest">Oldest first</option><option value="balance_high">Highest balance</option><option value="balance_low">Lowest balance</option></select></label>
      <label className="invoice-register__toggle"><input type="checkbox" checked={openBalanceOnly} onChange={(event) => setOpenBalanceOnly(event.target.checked)} /><span>Show open balances only</span></label>
    </div>
    <GroupedInvoiceRegister invoices={filteredInvoices} today={today} />
  </section>;
}
