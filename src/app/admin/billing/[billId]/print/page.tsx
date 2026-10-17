import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintAction } from "@/components/print/print-action";
import { requireMasterAdmin } from "@/lib/admin/guard";
import { formatCurrency } from "@/lib/format/currency";
import { reconcileInvoiceStatus } from "@/lib/billing-reconciliation";

type Params = Promise<{ billId: string }>;

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-PK", { dateStyle: "long", timeZone: "UTC" }).format(date);
}

export default async function PlatformBillPrintPage({ params }: { params: Params }) {
  const { billId } = await params;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(billId)) notFound();

  const { supabase } = await requireMasterAdmin();
  const { data: bill, error: billError } = await supabase.from("platform_bills")
    .select("id,bill_number,description,total_amount,paid_amount,due_date,status,created_at,school_id")
    .eq("id", billId)
    .maybeSingle();
  if (billError) throw new Error("Platform bill could not be loaded for printing.");
  if (!bill) notFound();

  const [{ data: school, error: schoolError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase.from("schools")
      .select("name,code,email,phone,address,city,state,country,postal_code")
      .eq("id", bill.school_id)
      .maybeSingle(),
    supabase.from("platform_transactions")
      .select("id,transaction_reference,amount,payment_method,transaction_date")
      .eq("school_id", bill.school_id)
      .eq("bill_id", bill.id)
      .order("transaction_date", { ascending: true }),
  ]);
  if (schoolError || paymentsError) throw new Error("Platform bill details could not be loaded for printing.");
  if (!school) notFound();

  const total = Number(bill.total_amount ?? 0);
  const paid = Number(bill.paid_amount ?? 0);
  const due = reconcileInvoiceStatus({ total, paidAmount: paid, dueDate: String(bill.due_date ?? "") });
  const address = [school.address, school.city, school.state, school.postal_code, school.country].filter(Boolean).join(", ");
  const issuedOn = formatDate(String(bill.created_at ?? "").slice(0, 10));
  const statusLabel = due.status.replaceAll("_", " ");

  return <main className="school-document-page platform-bill-print-page">
    <div className="school-document-toolbar no-print">
      <Link href="/admin/billing">← Back to billing</Link>
      <PrintAction label="Print bill / Save PDF" />
    </div>
    <article className="platform-bill-document">
      <header className="platform-bill-document__header">
        <div className="platform-bill-document__brand">
          <Image src="/brand/landscape_logo.png" alt="Schooliva" width={190} height={56} priority />
          <span>School management, clearly managed.</span>
        </div>
        <div className="platform-bill-document__heading">
          <span>SCHOOLIVA PLATFORM</span>
          <h1>PLATFORM BILL</h1>
          <strong>{bill.bill_number}</strong>
        </div>
      </header>

      <section className="platform-bill-document__parties">
        <div><span>BILLED TO</span><h2>{school.name}</h2><p>School code: {school.code}</p>
          {address && <p>{address}</p>}
          {(school.email || school.phone) && <p>{[school.email, school.phone].filter(Boolean).join(" · ")}</p>}
        </div>
        <dl>
          <div><dt>Issue date</dt><dd>{issuedOn}</dd></div>
          <div><dt>Due date</dt><dd>{formatDate(String(bill.due_date))}</dd></div>
          <div><dt>Status</dt><dd className={`platform-bill-document__status is-${due.status}`}>{statusLabel}</dd></div>
        </dl>
      </section>

      <table className="platform-bill-document__table">
        <thead><tr><th>Description</th><th>Billing reference</th><th className="is-amount">Amount</th></tr></thead>
        <tbody><tr><td><strong>{bill.description}</strong><small>Schooliva platform services</small></td><td>{bill.bill_number}</td><td className="is-amount">{formatCurrency(total)}</td></tr></tbody>
      </table>

      <section className="platform-bill-document__summary">
        <div><span>Bill total</span><strong>{formatCurrency(total)}</strong></div>
        <div><span>Payments received</span><strong>− {formatCurrency(paid)}</strong></div>
        <div className="is-due"><span>Balance due</span><strong>{formatCurrency(due.remainingAmount)}</strong></div>
      </section>

      <section className="platform-bill-document__payment">
        <h2>Payment record</h2>
        {payments?.length ? <table className="platform-bill-document__payments">
          <thead><tr><th>Transaction reference</th><th>Date</th><th>Method</th><th className="is-amount">Amount</th></tr></thead>
          <tbody>{payments.map((payment) => <tr key={payment.id}>
            <td>{payment.transaction_reference}</td>
            <td>{formatDate(String(payment.transaction_date))}</td>
            <td>{String(payment.payment_method).replaceAll("_", " ")}</td>
            <td className="is-amount">{formatCurrency(payment.amount)}</td>
          </tr>)}</tbody>
        </table> : <p>No payments have been recorded for this bill.</p>}
      </section>

      <footer className="platform-bill-document__footer">
        <div><strong>Thank you for partnering with Schooliva.</strong><span>This bill was generated by Schooliva Platform. Please include the bill reference with your payment.</span></div>
        <span>Schooliva Platform</span>
      </footer>
    </article>
  </main>;
}
