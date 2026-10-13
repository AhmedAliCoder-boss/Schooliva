import { InvoiceForm } from "@/components/finance/finance-forms";
import { FinanceFormDisclosure } from "@/components/finance/finance-form-disclosure";
import Link from "next/link";
import { canManageFinance, requireFinanceContext } from "@/lib/finance/context";
import { formatCurrency } from "@/lib/format/currency";

type StudentRelation = { first_name: string | null; last_name: string | null } | Array<{ first_name: string | null; last_name: string | null }> | null;
function studentName(value: StudentRelation) {
  const student = Array.isArray(value) ? value[0] : value;
  return [student?.first_name, student?.last_name].filter(Boolean).join(" ") || "Student";
}

export default async function FinanceInvoicesPage() {
  const { supabase, schoolId } = await requireFinanceContext("view");
  const [{ data: invoices, error: invoicesError }, { data: sessions, error: sessionsError }, { data: students, error: studentsError }, { data: structures, error: structuresError }, canManage] = await Promise.all([
    supabase.from("fee_invoices").select("id,invoice_number,student_id,status,total,paid_amount,remaining_amount,due_date,students(first_name,last_name)").eq("school_id", schoolId).order("created_at", { ascending: false }),
    supabase.from("academic_sessions").select("id,name").eq("school_id", schoolId).order("starts_on", { ascending: false }),
    supabase.from("students").select("id,first_name,last_name,admission_number").eq("school_id", schoolId).eq("status", "active").order("last_name"),
    supabase.from("fee_structures").select("id,fee_type,amount").eq("school_id", schoolId).eq("is_active", true).order("fee_type"),
    canManageFinance(supabase, schoolId),
  ]);
  if (invoicesError || sessionsError || studentsError || structuresError) throw new Error("Invoice workspace data could not be loaded.");
  const studentOptions = (students ?? []).map((student) => ({ id: String(student.id), name: `${student.first_name ?? ""} ${student.last_name ?? ""} (${student.admission_number ?? "-"})`.trim() }));
  const feeOptions = (structures ?? []).map((row) => ({ id: String(row.id), name: `${row.fee_type} - ${formatCurrency(row.amount)}` }));
  const invoiceRows = invoices ?? [];

  return <main className="students-shell finance-shell">
    <section className="module-page-header"><div className="module-page-header__row"><div>
      <p className="module-page-header__eyebrow">Finance / Billing</p><h1>Invoices</h1>
      <p>Create student bills from active fee structures and track outstanding balances.</p>
    </div></div></section>
    <section className="finance-work-grid">
      {canManage && <FinanceFormDisclosure label="Billing" title="Create invoice" description="Choose a student, academic session, and fee items.">
        <InvoiceForm sessions={(sessions ?? []).map((row) => ({ id: String(row.id), name: String(row.name) }))} students={studentOptions} feeStructures={feeOptions} />
      </FinanceFormDisclosure>}
      <section className="finance-work-card finance-work-card--records" aria-labelledby="invoice-list-title">
        <header className="finance-work-card__heading"><div><span className="dashboard-panel-kicker">Invoice register</span><h2 id="invoice-list-title">Student invoices</h2><p>{invoiceRows.length} invoices</p></div></header>
        <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Invoice</th><th>Student</th><th>Due date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th className="no-print">Document</th></tr></thead><tbody>{invoiceRows.length ? invoiceRows.map((invoice) => <tr key={String(invoice.id)}><td>{String(invoice.invoice_number)}</td><td>{studentName(invoice.students as StudentRelation)}</td><td>{String(invoice.due_date)}</td><td>{formatCurrency(invoice.total)}</td><td>{formatCurrency(invoice.paid_amount)}</td><td>{formatCurrency(invoice.remaining_amount)}</td><td><span className={`status-pill ${String(invoice.status)}`}>{String(invoice.status).replaceAll("_", " ")}</span></td><td className="no-print"><Link className="school-document-link" href={`/finance/print/invoice/${invoice.id}`}>Print / PDF</Link></td></tr>) : <tr><td colSpan={8}><div className="student-empty"><h3>No invoices yet</h3><p>Create an invoice to start tracking student balances.</p></div></td></tr>}</tbody></table></div>
      </section>
    </section>
  </main>;
}
