"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { createPlatformBill, recordPlatformTransaction, reconcilePlatformBills } from "@/app/actions/admin";
import { FinanceFormDisclosure } from "@/components/finance/finance-form-disclosure";
import { formatCurrency } from "@/lib/format/currency";

type FinanceBill = {
  id: string;
  billNumber: string;
  schoolId: string;
  schoolName: string;
  description: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  status: string;
};

type FinanceSchool = { id: string; name: string };
type Payment = {
  id: string;
  billId: string;
  reference: string;
  amount: number;
  method: string;
  date: string;
  schoolId: string;
  schoolName: string;
  billNumber: string;
};

const pageSize = 25;
const statusLabels: Record<string, string> = {
  paid: "Paid",
  partially_paid: "Partially paid",
  overdue: "Overdue",
  unpaid: "Unpaid",
};

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const content = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function daysLate(dueDate: string, today: string) {
  if (!dueDate || dueDate >= today) return 0;
  const due = new Date(`${dueDate}T00:00:00Z`).getTime();
  const current = new Date(`${today}T00:00:00Z`).getTime();
  return Math.floor((current - due) / 86_400_000);
}

function statusClass(status: string) {
  if (status === "paid") return "admin-badge--positive";
  if (status === "overdue") return "admin-badge--warning";
  return "admin-badge--neutral";
}

export function PlatformFinanceWorkspace({
  bills,
  schools,
  asOfDate,
}: {
  bills: FinanceBill[];
  schools: FinanceSchool[];
  asOfDate: string;
}) {
  const [schoolId, setSchoolId] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const today = asOfDate;

  const scopedBills = useMemo(
    () => schoolId === "all" ? bills : bills.filter((bill) => bill.schoolId === schoolId),
    [bills, schoolId],
  );
  const metrics = useMemo(() => {
    const total = scopedBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const collected = scopedBills.reduce((sum, bill) => sum + bill.paidAmount, 0);
    const outstanding = scopedBills.reduce((sum, bill) => sum + bill.remainingAmount, 0);
    const overdue = scopedBills.filter((bill) => bill.status === "overdue");
    return {
      total,
      collected,
      outstanding,
      overdueAmount: overdue.reduce((sum, bill) => sum + bill.remainingAmount, 0),
      overdueCount: overdue.length,
      collectionRate: total > 0 ? Math.round((collected / total) * 100) : 0,
    };
  }, [scopedBills]);

  const aging = useMemo(() => {
    const buckets = [
      { label: "1–30 days", amount: 0, count: 0 },
      { label: "31–60 days", amount: 0, count: 0 },
      { label: "61+ days", amount: 0, count: 0 },
    ];
    for (const bill of scopedBills) {
      if (bill.remainingAmount <= 0) continue;
      const late = daysLate(bill.dueDate, today);
      if (!late) continue;
      const bucket = late <= 30 ? buckets[0] : late <= 60 ? buckets[1] : buckets[2];
      bucket.amount += bill.remainingAmount;
      bucket.count += 1;
    }
    return buckets;
  }, [scopedBills, today]);

  const schoolExposure = useMemo(() => {
    const totals = new Map<string, { name: string; outstanding: number; overdue: number; bills: number }>();
    for (const bill of scopedBills) {
      const current = totals.get(bill.schoolId) ?? { name: bill.schoolName, outstanding: 0, overdue: 0, bills: 0 };
      current.outstanding += bill.remainingAmount;
      current.overdue += bill.status === "overdue" ? bill.remainingAmount : 0;
      current.bills += 1;
      totals.set(bill.schoolId, current);
    }
    return [...totals.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 6);
  }, [scopedBills]);

  const filteredBills = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return scopedBills.filter((bill) => {
      const matchesStatus = status === "all" || bill.status === status;
      const matchesSearch = !needle || [bill.billNumber, bill.schoolName, bill.description]
        .some((value) => value.toLocaleLowerCase().includes(needle));
      return matchesStatus && matchesSearch;
    });
  }, [scopedBills, search, status]);
  const pageCount = Math.max(1, Math.ceil(filteredBills.length / pageSize));
  const visibleBills = filteredBills.slice((page - 1) * pageSize, page * pageSize);

  function exportBills() {
    const rows: Array<Array<string | number>> = [
      ["Bill number", "School", "Description", "Amount", "Paid", "Outstanding", "Due date", "Status"],
      ...filteredBills.map((bill) => [
        bill.billNumber,
        bill.schoolName,
        bill.description,
        bill.totalAmount,
        bill.paidAmount,
        bill.remainingAmount,
        bill.dueDate,
        statusLabels[bill.status] ?? bill.status,
      ]),
    ];
    downloadCsv(`schooliva-platform-billing-${today}.csv`, rows);
  }

  return <div className="platform-finance">
    <section className="platform-finance__hero">
      <div>
        <span className="platform-finance__eyebrow"><i /> PLATFORM FINANCE · ALL SCHOOLS</span>
        <h2>Receivables, under control.</h2>
        <p>One command center for school billing, collections, and overdue exposure.</p>
      </div>
      <div className="platform-finance__hero-actions">
        <Link className="platform-finance__button platform-finance__button--light" href="/admin/payments">View payment ledger <span aria-hidden="true">→</span></Link>
        <Link className="platform-finance__button platform-finance__button--outline" href="/admin/billing/outstanding">Open collections queue</Link>
      </div>
      <div className="platform-finance__hero-art" aria-hidden="true">₨</div>
    </section>

    <nav className="platform-finance__tabs" aria-label="Platform finance sections">
      <Link href="/admin/billing" aria-current="page">Billing overview</Link>
      <Link href="/admin/payments">Payments ledger</Link>
      <Link href="/admin/billing/outstanding">Outstanding queue <span>{bills.filter((bill) => bill.remainingAmount > 0).length}</span></Link>
    </nav>

    <section className="platform-finance__metrics" aria-label="Platform finance summary">
      <article><span>Total billed</span><strong>{formatCurrency(metrics.total)}</strong><small>{scopedBills.length} platform bills</small><i className="platform-finance__metric-icon">↗</i></article>
      <article><span>Collected to date</span><strong>{formatCurrency(metrics.collected)}</strong><small>{metrics.collectionRate}% collection rate</small><i className="platform-finance__metric-icon">✓</i></article>
      <article><span>Outstanding balance</span><strong>{formatCurrency(metrics.outstanding)}</strong><small>Across {schoolId === "all" ? schools.length : 1} school{schoolId === "all" && schools.length !== 1 ? "s" : ""}</small><i className="platform-finance__metric-icon">◷</i></article>
      <article className="is-warning"><span>Overdue exposure</span><strong>{formatCurrency(metrics.overdueAmount)}</strong><small>{metrics.overdueCount} bill{metrics.overdueCount === 1 ? "" : "s"} need attention</small><i className="platform-finance__metric-icon">!</i></article>
    </section>

    <section className="platform-finance__insights">
      <article className="platform-finance__panel platform-finance__aging">
        <div className="platform-finance__section-heading"><div><span className="platform-finance__label">COLLECTION RISK</span><h3>Receivables aging</h3></div><Link href="/admin/billing/outstanding">Review all <span aria-hidden="true">→</span></Link></div>
        <p>Unpaid balances grouped by time past due.</p>
        <div className="platform-finance__aging-list">{aging.map((bucket, index) => {
          const percentage = metrics.overdueAmount > 0 ? Math.round(bucket.amount / metrics.overdueAmount * 100) : 0;
          return <div className="platform-finance__aging-row" key={bucket.label}>
            <div><span className={`platform-finance__aging-dot tone-${index}`} /><strong>{bucket.label}</strong><small>{bucket.count} bill{bucket.count === 1 ? "" : "s"}</small><b>{formatCurrency(bucket.amount)}</b></div>
            <span className="platform-finance__progress"><i style={{ width: `${percentage}%` }} /></span>
          </div>;
        })}</div>
      </article>
      <article className="platform-finance__panel platform-finance__exposure">
        <div className="platform-finance__section-heading"><div><span className="platform-finance__label">SCHOOL PORTFOLIO</span><h3>Highest exposure</h3></div><span className="platform-finance__count">{schoolExposure.length} schools</span></div>
        <div className="platform-finance__school-list">{schoolExposure.map((school, index) => {
          const share = metrics.outstanding > 0 ? Math.round(school.outstanding / metrics.outstanding * 100) : 0;
          return <div className="platform-finance__school-row" key={school.id}>
            <span className="platform-finance__rank">{String(index + 1).padStart(2, "0")}</span>
            <div className="platform-finance__school-main"><strong>{school.name}</strong><small>{school.bills} bill{school.bills === 1 ? "" : "s"} · {share}% of open balance</small><span className="platform-finance__progress"><i style={{ width: `${share}%` }} /></span></div>
            <div className="platform-finance__school-amount"><strong>{formatCurrency(school.outstanding)}</strong><small>{school.overdue > 0 ? `${formatCurrency(school.overdue)} overdue` : "No overdue balance"}</small></div>
          </div>;
        })}{!schoolExposure.length && <p className="platform-finance__empty">No school billing records to summarize yet.</p>}</div>
      </article>
    </section>

    <section className="platform-finance__panel platform-finance__bill-panel">
      <details className="platform-finance__create">
        <summary><span className="platform-finance__create-icon">＋</span><span><strong>Issue a platform bill</strong><small>Create a charge for any school and add it to the collections workflow.</small></span><b>New bill <span aria-hidden="true">⌄</span></b></summary>
        <form action={createPlatformBill} className="student-form">
          <div className="student-form-grid">
            <label className="student-field">School<select name="schoolId" required defaultValue={schoolId === "all" ? "" : schoolId}><option value="" disabled>Select a school</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
            <div className="student-field platform-finance__auto-number"><span>Bill number</span><strong>Generated automatically</strong><small>Unique bill reference assigned when saved.</small></div>
            <label className="student-field">Description<input name="description" placeholder="Subscription, onboarding, or service" required /></label>
            <label className="student-field">Amount (PKR)<input type="number" name="amount" min="0.01" step="0.01" required /></label>
            <label className="student-field">Due date<input type="date" name="dueDate" required /></label>
          </div>
          <button type="submit" className="platform-finance__button platform-finance__button--primary">Create platform bill</button>
        </form>
      </details>
    </section>

    <section className="platform-finance__panel platform-finance__bill-panel">
      <div className="platform-finance__section-heading platform-finance__bill-heading">
        <div><span className="platform-finance__label">BILLING OPERATIONS</span><h3>School bills</h3><p>Search, filter, reconcile, and export platform charges.</p></div>
        <div className="platform-finance__actions">
          <button type="button" className="platform-finance__button platform-finance__button--secondary" onClick={exportBills} disabled={!filteredBills.length}>Export CSV</button>
          <form action={reconcilePlatformBills}><button className="platform-finance__button platform-finance__button--primary" type="submit">Reconcile all</button></form>
        </div>
      </div>
      <div className="platform-finance__filters">
        <label className="platform-finance__search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search bills, schools, descriptions…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} aria-label="Search platform bills" /></label>
        <label><span className="platform-finance__sr-only">Filter by school</span><select value={schoolId} onChange={(event) => { setSchoolId(event.target.value); setPage(1); }}><option value="all">All schools</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
        <label><span className="platform-finance__sr-only">Filter by status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">All statuses</option><option value="unpaid">Unpaid</option><option value="partially_paid">Partially paid</option><option value="overdue">Overdue</option><option value="paid">Paid</option></select></label>
      </div>
      <div className="platform-finance__table-wrap">
        <table className="platform-finance__table">
          <thead><tr><th>Bill &amp; description</th><th>School</th><th>Total</th><th>Collected</th><th>Balance</th><th>Due date</th><th>Status</th><th>Document</th></tr></thead>
          <tbody>{visibleBills.map((bill) => <tr key={bill.id}>
            <td><strong>{bill.billNumber}</strong><small>{bill.description}</small></td>
            <td>{bill.schoolName}</td>
            <td>{formatCurrency(bill.totalAmount)}</td>
            <td>{formatCurrency(bill.paidAmount)}</td>
            <td><strong>{formatCurrency(bill.remainingAmount)}</strong></td>
            <td>{bill.dueDate}</td>
            <td><span className={`admin-badge ${statusClass(bill.status)}`}>{statusLabels[bill.status] ?? bill.status}</span></td>
            <td><Link className="platform-finance__print-link" href={`/admin/billing/${bill.id}/print`}>Print / PDF <span aria-hidden="true">↗</span></Link></td>
          </tr>)}{!visibleBills.length && <tr><td colSpan={8} className="platform-finance__empty">No bills match the selected filters.</td></tr>}</tbody>
        </table>
      </div>
      <div className="platform-finance__pagination"><span>Showing {filteredBills.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredBills.length)} of {filteredBills.length} bills</span><div><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</button><span>Page {page} of {pageCount}</span><button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount}>Next</button></div></div>
    </section>
  </div>;
}

export function PlatformPaymentsWorkspace({
  payments,
  schools,
  outstandingBills,
  asOfDate,
}: {
  payments: Payment[];
  schools: FinanceSchool[];
  outstandingBills: Array<{
    id: string;
    billNumber: string;
    schoolId: string;
    schoolName: string;
    description: string;
    totalAmount: number;
    paidAmount: number;
    balance: number;
    dueDate: string;
    status: string;
  }>;
  asOfDate: string;
}) {
  const [schoolId, setSchoolId] = useState("all");
  const [method, setMethod] = useState("all");
  const [search, setSearch] = useState("");
  const visiblePayments = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return payments.filter((payment) =>
      (schoolId === "all" || payment.schoolId === schoolId)
      && (method === "all" || payment.method === method)
      && (!needle || [payment.reference, payment.schoolName, payment.billNumber].some((value) => value.toLocaleLowerCase().includes(needle))),
    );
  }, [method, payments, schoolId, search]);
  const totalReceived = visiblePayments.reduce((sum, payment) => sum + payment.amount, 0);

  function exportPayments() {
    downloadCsv(`schooliva-payment-ledger-${asOfDate}.csv`, [
      ["Reference", "School", "Bill", "Amount", "Method", "Transaction date"],
      ...visiblePayments.map((payment) => [payment.reference, payment.schoolName, payment.billNumber, payment.amount, payment.method.replaceAll("_", " "), payment.date]),
    ]);
  }

  return <div className="platform-finance">
    <section className="platform-finance__hero platform-finance__hero--payments">
      <div><span className="platform-finance__eyebrow"><i /> PLATFORM FINANCE · ALL SCHOOLS</span><h2>Every collection, accounted for.</h2><p>Review the latest platform transactions and record new bill payments.</p></div>
      <Link className="platform-finance__button platform-finance__button--light" href="/admin/billing">Back to billing overview <span aria-hidden="true">→</span></Link>
      <div className="platform-finance__hero-art" aria-hidden="true">↗</div>
    </section>
    <nav className="platform-finance__tabs" aria-label="Platform finance sections">
      <Link href="/admin/billing">Billing overview</Link><Link href="/admin/payments" aria-current="page">Payments ledger</Link><Link href="/admin/billing/outstanding">Outstanding queue</Link>
    </nav>
    <section className="platform-finance__metrics platform-finance__metrics--payments">
      <article><span>Transactions shown</span><strong>{visiblePayments.length}</strong><small>From the latest 100 platform payments</small><i className="platform-finance__metric-icon">↗</i></article>
      <article><span>Received in view</span><strong>{formatCurrency(totalReceived)}</strong><small>Filtered ledger total</small><i className="platform-finance__metric-icon">✓</i></article>
      <article><span>Schools represented</span><strong>{new Set(visiblePayments.map((payment) => payment.schoolName)).size}</strong><small>Across the current selection</small><i className="platform-finance__metric-icon">⌂</i></article>
    </section>
    <section className="platform-finance__payment-disclosure">
      <FinanceFormDisclosure
        label="Collection operations"
        title="Record a school bill payment"
        description="Choose an outstanding school bill to review its details and record a payment."
      >
      <PaymentEntryForm outstandingBills={outstandingBills} asOfDate={asOfDate} />
      </FinanceFormDisclosure>
    </section>
    <section className="platform-finance__panel platform-finance__bill-panel">
      <div className="platform-finance__section-heading platform-finance__bill-heading"><div><span className="platform-finance__label">AUDITABLE COLLECTIONS</span><h3>Payment ledger</h3><p>Search by reference, school, or bill; export the filtered ledger.</p></div><button type="button" className="platform-finance__button platform-finance__button--secondary" onClick={exportPayments} disabled={!visiblePayments.length}>Export CSV</button></div>
      <div className="platform-finance__filters">
        <label className="platform-finance__search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search reference, school, bill…" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search payments" /></label>
        <label><span className="platform-finance__sr-only">Filter payments by school</span><select value={schoolId} onChange={(event) => setSchoolId(event.target.value)}><option value="all">All schools</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
        <label><span className="platform-finance__sr-only">Filter by payment method</span><select value={method} onChange={(event) => setMethod(event.target.value)}><option value="all">All methods</option>{["cash", "bank_transfer", "card", "upi", "cheque", "other"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      </div>
      <div className="platform-finance__table-wrap"><table className="platform-finance__table"><thead><tr><th>Reference</th><th>School &amp; bill</th><th>Amount</th><th>Method</th><th>Transaction date</th><th>Receipt</th></tr></thead><tbody>{visiblePayments.map((payment) => <tr key={payment.id}><td><strong>{payment.reference}</strong></td><td><strong>{payment.schoolName}</strong><small>{payment.billNumber}</small></td><td><strong>{formatCurrency(payment.amount)}</strong></td><td>{payment.method.replaceAll("_", " ")}</td><td>{payment.date}</td><td><Link className="platform-finance__print-link" href={`/admin/payments/${payment.id}/print`}>Print receipt <span aria-hidden="true">↗</span></Link></td></tr>)}{!visiblePayments.length && <tr><td colSpan={6} className="platform-finance__empty">No payments match the selected filters.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}

function PaymentEntryForm({
  outstandingBills,
  asOfDate,
}: {
  outstandingBills: Array<{
    id: string;
    billNumber: string;
    schoolId: string;
    schoolName: string;
    description: string;
    totalAmount: number;
    paidAmount: number;
    balance: number;
    dueDate: string;
    status: string;
  }>;
  asOfDate: string;
}) {
  const [selectedBillId, setSelectedBillId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const selectedBill = outstandingBills.find((bill) => bill.id === selectedBillId);
  const enteredPayment = Number(paymentAmount);
  const balanceCents = selectedBill ? Math.round(selectedBill.balance * 100) : 0;
  const enteredPaymentCents = Number.isFinite(enteredPayment) ? Math.round(enteredPayment * 100) : 0;
  const isPaymentValid = Boolean(selectedBill && enteredPaymentCents > 0 && enteredPaymentCents <= balanceCents);
  const projectedBalance = selectedBill
    ? Math.max(balanceCents - Math.min(enteredPaymentCents, balanceCents), 0) / 100
    : 0;
  const projectedStatus = selectedBill && isPaymentValid
    ? projectedBalance === 0
      ? "paid"
      : selectedBill.dueDate < asOfDate
        ? "overdue"
        : "partially_paid"
    : selectedBill?.status ?? "";

  if (!outstandingBills.length) {
    return <p className="platform-finance__empty">There are no outstanding school bills available to receive a payment. <Link href="/admin/billing">Create a bill from the billing overview.</Link></p>;
  }
  return <form action={recordPlatformTransaction} className="student-form">
    <div className="student-form-grid">
      <label className="student-field">School bill<select name="billId" required value={selectedBillId} onChange={(event) => { setSelectedBillId(event.target.value); setPaymentAmount(""); }}><option value="" disabled>Select an outstanding bill</option>{outstandingBills.map((bill) => <option key={bill.id} value={bill.id}>{bill.billNumber} · {bill.schoolName} · {formatCurrency(bill.balance)} due</option>)}</select></label>
      <label className="student-field">Amount<input type="number" name="amount" min="0.01" max={selectedBill?.balance} step="0.01" required disabled={!selectedBill} value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} aria-invalid={Boolean(selectedBill && paymentAmount && !isPaymentValid)} /></label>
      <label className="student-field">Method<select name="paymentMethod" defaultValue="bank_transfer"><option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option><option value="card">Card</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="other">Other</option></select></label>
      <label className="student-field">Transaction date<input type="date" name="transactionDate" defaultValue={asOfDate} required /></label>
      <label className="student-field student-field-wide">Notes<textarea name="notes" rows={3} /></label>
    </div>
    {selectedBill && <section className="platform-finance__selected-bill" aria-live="polite" aria-label="Selected bill details">
      <div className="platform-finance__selected-bill-heading"><div><span className="platform-finance__label">{isPaymentValid ? "PAYMENT PREVIEW" : "SELECTED SCHOOL BILL"}</span><h4>{selectedBill.schoolName}</h4></div><span className={`admin-badge ${statusClass(projectedStatus)}`}>{statusLabels[projectedStatus] ?? projectedStatus}</span></div>
      <p className="platform-finance__selected-bill-description">{selectedBill.description}</p>
      <dl>
        <div><dt>Bill number</dt><dd>{selectedBill.billNumber}</dd></div>
        <div><dt>Total amount</dt><dd>{formatCurrency(selectedBill.totalAmount)}</dd></div>
        <div><dt>Already paid</dt><dd>{formatCurrency(selectedBill.paidAmount)}</dd></div>
        {isPaymentValid && <div><dt>Payment being recorded</dt><dd>− {formatCurrency(enteredPaymentCents / 100)}</dd></div>}
        <div><dt>Due date</dt><dd>{selectedBill.dueDate}</dd></div>
        <div className="is-balance"><dt>{isPaymentValid ? "Balance after payment" : "Remaining balance"}</dt><dd>{formatCurrency(isPaymentValid ? projectedBalance : selectedBill.balance)}</dd></div>
      </dl>
      {Boolean(selectedBill && paymentAmount && !isPaymentValid)
        ? <small className="platform-finance__payment-warning">Enter an amount greater than zero and no more than {formatCurrency(selectedBill.balance)}.</small>
        : <small>Payment amount cannot exceed the remaining balance.</small>}
    </section>}
    <button type="submit" className="platform-finance__button platform-finance__button--primary" disabled={!selectedBill || !isPaymentValid}>Record transaction</button>
  </form>;
}
