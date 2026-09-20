import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format/currency";
import { FeeStructureForm, InvoiceForm, PaymentForm } from "@/components/finance/finance-forms";

function relation<T>(value: unknown): T | null { return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null; }

export default async function FinancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { data: membership } = await supabase.from("user_roles").select("school_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership?.school_id) redirect("/setup?onboarding=1");
  const schoolId = membership.school_id as string;

  const [{ data: sessions }, { data: classes }, { data: structures }, { data: students }, { data: invoices }, { data: payments }] = await Promise.all([
    supabase.from("academic_sessions").select("id,name").eq("school_id", schoolId).order("starts_on", { ascending: false }),
    supabase.from("classes").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("fee_structures").select("id,fee_type,amount,frequency,due_day,is_optional,is_active").eq("school_id", schoolId).order("fee_type"),
    supabase.from("students").select("id,first_name,last_name,admission_number").eq("school_id", schoolId).eq("status", "active").order("last_name"),
    supabase.from("fee_invoices").select("id,invoice_number,student_id,status,total,paid_amount,remaining_amount,due_date,students(first_name,last_name)").eq("school_id", schoolId).order("due_date", { ascending: false }),
    supabase.from("fee_payments").select("id,payment_reference,amount,payment_method,payment_date,invoice_id").eq("school_id", schoolId).order("payment_date", { ascending: false }),
  ]);

  const feeStructureOptions = (structures ?? []).map((structure) => ({ id: String(structure.id), name: `${structure.fee_type} - ${formatCurrency(structure.amount)}` }));
  const invoiceOptions = (invoices ?? []).map((invoice) => ({ id: String(invoice.id), name: `${invoice.invoice_number} - ${String(invoice.status)}` }));
  const studentOptions = (students ?? []).map((student) => ({ id: String(student.id), name: `${student.first_name ?? ""} ${student.last_name ?? ""} (${student.admission_number ?? "-"})`.trim() }));

  const financeInvoices = invoices ?? [];
  const totalCollected = financeInvoices.reduce((sum, invoice) => sum + Number(invoice.paid_amount ?? 0), 0);
  const totalOutstanding = financeInvoices.reduce((sum, invoice) => sum + Number(invoice.remaining_amount ?? 0), 0);
  const paidCount = financeInvoices.filter((invoice) => String(invoice.status).toLowerCase() === "paid").length;
  const overdueCount = financeInvoices.filter((invoice) => String(invoice.status).toLowerCase() === "overdue").length;
  return <main className="students-shell">
    <header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/dashboard">Dashboard -&gt;</Link></header>
    <section className="module-page-header"><div className="module-page-header__row"><div><p className="module-page-header__eyebrow">Finance</p><h1>Fee and finance.</h1><p>Transaction-safe fee structures, invoices, payments, and collection dashboards.</p></div></div></section>
    <section className="module-kpi-grid"><article className="module-kpi"><span>Total collected</span><strong>{formatCurrency(totalCollected)}</strong></article><article className="module-kpi"><span>Outstanding</span><strong>{formatCurrency(totalOutstanding)}</strong></article><article className="module-kpi"><span>Paid invoices</span><strong>{paidCount}</strong></article><article className="module-kpi"><span>Overdue</span><strong>{overdueCount}</strong></article></section>
    <section className="setup-card"><h3>Fee structure</h3><FeeStructureForm sessions={sessions ?? []} classes={classes ?? []} /></section>
    <section className="setup-card"><h3>Generate invoice</h3><InvoiceForm sessions={sessions ?? []} students={studentOptions} feeStructures={feeStructureOptions} /></section>
    <section className="setup-card"><h3>Record payment</h3><PaymentForm invoices={invoiceOptions} /></section>

    <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Invoice</th><th>Student</th><th>Total</th><th>Paid</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>{(invoices ?? []).length ? (invoices ?? []).map((invoice) => { const student = relation<{ first_name: string; last_name: string }>(invoice.students); return <tr key={String(invoice.id)}><td>{String(invoice.invoice_number)}</td><td>{student?.first_name} {student?.last_name}</td><td>{formatCurrency(invoice.total)}</td><td>{formatCurrency(invoice.paid_amount)}</td><td>{formatCurrency(invoice.remaining_amount)}</td><td><span className={`status-pill ${String(invoice.status)}`}>{String(invoice.status)}</span></td></tr>; }) : <tr><td colSpan={6}><div className="student-empty"><h3>No invoices yet</h3><p>Invoices will appear here after fee generation.</p></div></td></tr>}</tbody></table></div>
    <div className="student-table-wrap" style={{ marginTop: 24 }}><table className="student-table"><thead><tr><th>Reference</th><th>Invoice</th><th>Method</th><th>Amount</th><th>Date</th></tr></thead><tbody>{(payments ?? []).length ? (payments ?? []).map((payment) => <tr key={String(payment.id)}><td>{String(payment.payment_reference)}</td><td>{String(payment.invoice_id)}</td><td>{String(payment.payment_method)}</td><td>{formatCurrency(payment.amount)}</td><td>{String(payment.payment_date)}</td></tr>) : <tr><td colSpan={5}><div className="student-empty"><h3>No payments yet</h3><p>Payment history will appear here.</p></div></td></tr>}</tbody></table></div>
  </main>;
}
