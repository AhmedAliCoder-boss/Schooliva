import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintAction } from "@/components/print/print-action";
import { requireMasterAdmin } from "@/lib/admin/guard";
import { formatCurrency } from "@/lib/format/currency";
import { reconcileInvoiceStatus } from "@/lib/billing-reconciliation";

type Params = Promise<{ paymentId: string }>;

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-PK", { dateStyle: "long", timeZone: "UTC" }).format(date);
}

export default async function PlatformPaymentReceiptPage({ params }: { params: Params }) {
  const { paymentId } = await params;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(paymentId)) notFound();

  const { supabase } = await requireMasterAdmin();
  const { data: payment, error: paymentError } = await supabase.from("platform_transactions")
    .select("id,school_id,bill_id,transaction_reference,amount,payment_method,transaction_date,created_at")
    .eq("id", paymentId)
    .maybeSingle();
  if (paymentError) throw new Error("Platform payment receipt could not be loaded.");
  if (!payment) notFound();

  const [{ data: bill, error: billError }, { data: school, error: schoolError }, { data: transactions, error: transactionsError }] = await Promise.all([
    supabase.from("platform_bills")
      .select("id,bill_number,description,total_amount,due_date")
      .eq("id", payment.bill_id)
      .eq("school_id", payment.school_id)
      .maybeSingle(),
    supabase.from("schools")
      .select("name,code")
      .eq("id", payment.school_id)
      .maybeSingle(),
    supabase.from("platform_transactions")
      .select("id,amount,created_at")
      .eq("school_id", payment.school_id)
      .eq("bill_id", payment.bill_id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  ]);
  if (billError || schoolError || transactionsError) throw new Error("Platform payment receipt details could not be loaded.");
  if (!bill || !school) notFound();

  const transactionIndex = (transactions ?? []).findIndex((transaction) => transaction.id === payment.id);
  if (transactionIndex < 0) notFound();
  const paidAfterTransaction = (transactions ?? [])
    .slice(0, transactionIndex + 1)
    .reduce((sum, transaction) => sum + Number(transaction.amount ?? 0), 0);
  const total = Number(bill.total_amount ?? 0);
  const amount = Number(payment.amount ?? 0);
  const remainingAfterTransaction = Math.max(total - paidAfterTransaction, 0);
  const billStatus = reconcileInvoiceStatus({
    total,
    paidAmount: paidAfterTransaction,
    dueDate: String(bill.due_date ?? ""),
  }).status;

  return <main className="school-document-page platform-bill-print-page platform-payment-print-page">
    <div className="school-document-toolbar no-print">
      <Link href="/admin/payments">← Back to payments</Link>
      <PrintAction label="Print receipt / Save PDF" />
    </div>
    <article className="platform-bill-document platform-payment-receipt">
      <header className="platform-bill-document__header">
        <div className="platform-bill-document__brand">
          <Image src="/brand/landscape_logo.png" alt="Schooliva" width={190} height={56} priority />
        </div>
        <div className="platform-bill-document__heading">
          <span>SCHOOLIVA PLATFORM</span>
          <h1>PAYMENT RECEIPT</h1>
          <strong>{payment.transaction_reference}</strong>
        </div>
      </header>

      <section className="platform-bill-document__parties">
        <div><span>RECEIVED FROM</span><h2>{school.name}</h2><p>School code: {school.code}</p></div>
        <dl>
          <div><dt>Receipt date</dt><dd>{formatDate(String(payment.transaction_date))}</dd></div>
          <div><dt>Payment method</dt><dd>{String(payment.payment_method).replaceAll("_", " ")}</dd></div>
        </dl>
      </section>

      <section className="platform-payment-receipt__confirmation">
        <span aria-hidden="true">✓</span>
        <div><strong>Payment received</strong><small>Receipt reference: {payment.transaction_reference}</small></div>
        <b>{formatCurrency(amount)}</b>
      </section>

      <table className="platform-bill-document__table">
        <thead><tr><th>Bill reference</th><th>Bill description</th><th>Due date</th><th className="is-amount">Bill total</th></tr></thead>
        <tbody><tr><td><strong>{bill.bill_number}</strong></td><td>{bill.description}</td><td>{formatDate(String(bill.due_date))}</td><td className="is-amount">{formatCurrency(total)}</td></tr></tbody>
      </table>

      <section className="platform-bill-document__summary">
        <div><span>Paid before this payment</span><strong>{formatCurrency(Math.max(paidAfterTransaction - amount, 0))}</strong></div>
        <div className="is-payment"><span>Payment received</span><strong>{formatCurrency(amount)}</strong></div>
        <div className="is-due"><span>Balance remaining</span><strong>{formatCurrency(remainingAfterTransaction)}</strong></div>
      </section>

      <section className="platform-payment-receipt__status" aria-label="Bill status after payment">
        <span>Bill status after payment</span>
        <strong className={`platform-bill-document__status is-${billStatus}`}>{billStatus.replaceAll("_", " ")}</strong>
      </section>

      <footer className="platform-bill-document__footer">
        <div><strong>Thank you for your payment.</strong><span>Keep this receipt for your records. Generated by Schooliva Platform.</span></div>
      </footer>
    </article>
  </main>;
}
