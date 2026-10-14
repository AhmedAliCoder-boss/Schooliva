import Link from "next/link";

import { PaymentForm } from "@/components/finance/finance-forms";
import { FinanceFormDisclosure } from "@/components/finance/finance-form-disclosure";
import { canManageFinance, requireFinanceContext } from "@/lib/finance/context";
import { formatCurrency } from "@/lib/format/currency";

export default async function FinancePaymentsPage() {
  const { supabase, schoolId } = await requireFinanceContext("view");
  const [{ data: payments, error: paymentsError }, { data: studentInvoices, error: studentInvoicesError }, canManage] = await Promise.all([
    supabase.from("fee_payments").select("id,payment_reference,invoice_id,amount,payment_method,payment_date,notes").eq("school_id", schoolId).order("payment_date", { ascending: false }),
    supabase.from("fee_invoices").select("id,invoice_number,total,paid_amount,remaining_amount,status,due_date,students(first_name,middle_name,last_name,admission_number,student_identifier),fee_invoice_items(fee_type,description,amount,is_optional)").eq("school_id", schoolId).order("due_date", { ascending: false }),
    canManageFinance(supabase, schoolId),
  ]);
  if (paymentsError || studentInvoicesError) {
    console.error("Payment workspace data could not be loaded.", { paymentsError, studentInvoicesError });
    throw new Error("Payment workspace data could not be loaded.");
  }
  const invoiceRows = studentInvoices ?? [];
  const invoiceNumbers = new Map(invoiceRows.map((row) => [String(row.id), String(row.invoice_number)]));
  const searchablePayableInvoices = (studentInvoices ?? [])
    .filter((row) => Number(row.remaining_amount) > 0 && String(row.status) !== "cancelled")
    .map((row) => {
      const student = Array.isArray(row.students) ? row.students[0] : row.students;
      const studentName = [student?.first_name, student?.middle_name, student?.last_name].filter(Boolean).join(" ");
      return {
        id: String(row.id),
        invoiceNumber: String(row.invoice_number),
        studentName: studentName || "Student",
        studentIdentifier: student?.student_identifier ?? "",
        admissionNumber: student?.admission_number ?? "",
        dueDate: String(row.due_date),
        total: Number(row.total ?? 0),
        paidAmount: Number(row.paid_amount ?? 0),
        remainingAmount: Number(row.remaining_amount ?? 0),
        status: String(row.status),
        name: `${row.invoice_number} · ${studentName || "Student"} · ${formatCurrency(row.remaining_amount)} due`,
        searchText: `${student?.admission_number ?? ""} ${student?.student_identifier ?? ""}`,
        items: (Array.isArray(row.fee_invoice_items) ? row.fee_invoice_items : []).map((item) => ({
          description: item.description || String(item.fee_type).replaceAll("_", " "),
          amount: Number(item.amount ?? 0),
          optional: Boolean(item.is_optional),
        })),
      };
    });

  return <main className="students-shell finance-shell">
    <section className="module-page-header"><div className="module-page-header__row"><div>
      <p className="module-page-header__eyebrow">Finance / Collections</p><h1>Payments</h1>
      <p>Record collections against an invoice and review payment history.</p>
    </div></div></section>
    <section className="finance-work-grid">
      {canManage && <FinanceFormDisclosure label="Collection" title="Record payment" description="Select an invoice with an outstanding balance.">
        <PaymentForm invoices={searchablePayableInvoices} />
      </FinanceFormDisclosure>}
      <section className="finance-work-card finance-work-card--records" aria-labelledby="payments-list-title">
        <header className="finance-work-card__heading"><div><span className="dashboard-panel-kicker">Collection register</span><h2 id="payments-list-title">Payment history</h2><p>{payments?.length ?? 0} recorded payments</p></div></header>
        <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Reference</th><th>Invoice</th><th>Method</th><th>Amount</th><th>Date</th><th>Notes</th><th className="no-print">Document</th></tr></thead><tbody>{(payments ?? []).length ? payments?.map((payment) => <tr key={String(payment.id)}><td>{String(payment.payment_reference)}</td><td>{invoiceNumbers.get(String(payment.invoice_id)) ?? "Invoice unavailable"}</td><td>{String(payment.payment_method).replaceAll("_", " ")}</td><td>{formatCurrency(payment.amount)}</td><td>{String(payment.payment_date)}</td><td>{payment.notes ?? "-"}</td><td className="no-print"><Link className="school-document-link" href={`/finance/print/payment/${payment.id}`}>Receipt / PDF</Link></td></tr>) : <tr><td colSpan={7}><div className="student-empty"><h3>No payments yet</h3><p>Recorded payments will appear here.</p></div></td></tr>}</tbody></table></div>
      </section>
    </section>
  </main>;
}
