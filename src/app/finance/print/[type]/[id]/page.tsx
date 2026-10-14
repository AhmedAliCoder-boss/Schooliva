import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintAction } from "@/components/print/print-action";
import { SchoolDocument } from "@/components/print/school-document";
import { requireFinanceContext } from "@/lib/finance/context";
import { formatCurrency } from "@/lib/format/currency";
import { getSchoolDocumentIdentity } from "@/lib/print/school-document";

type Params = Promise<{ type: string; id: string }>;

function todayInSchoolTimeZone() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function FinancePrintPage({ params }: { params: Params }) {
  const { type, id } = await params;
  if (type !== "invoice" && type !== "management-invoice" && type !== "payment" && type !== "expense") notFound();

  const { supabase, schoolId } = await requireFinanceContext("view", type === "expense" ? "finance" : "fees");
  const school = await getSchoolDocumentIdentity(supabase, schoolId);

  if (type === "management-invoice") {
    const [{ data: invoice, error }, { data: items, error: itemsError }] = await Promise.all([
      supabase.from("management_invoices").select("id,invoice_number,recipient_name,recipient_email,recipient_phone,status,subtotal,paid_amount,remaining_amount,due_date,notes").eq("id", id).eq("school_id", schoolId).maybeSingle(),
      supabase.from("management_invoice_items").select("description,quantity,unit_price,amount").eq("invoice_id", id).eq("school_id", schoolId).order("created_at"),
    ]);
    if (error || itemsError) throw new Error("Management invoice document could not be loaded.");
    if (!invoice) notFound();
    const managementStatus = (invoice.status === "unpaid" || invoice.status === "partially_paid")
      && String(invoice.due_date) < todayInSchoolTimeZone()
      ? "overdue"
      : String(invoice.status);
    return <main className="school-document-page"><div className="school-document-toolbar no-print"><Link href="/finance/invoices">Back to invoices</Link><PrintAction label="Print invoice / Save PDF" /></div>
      <SchoolDocument school={school} title="Management invoice" reference={String(invoice.invoice_number)} className="school-document--invoice">
        <dl className="school-document__facts">
          <div><dt>Bill to</dt><dd>{invoice.recipient_name}</dd></div>
          <div><dt>Email</dt><dd>{invoice.recipient_email ?? "-"}</dd></div>
          <div><dt>Phone</dt><dd>{invoice.recipient_phone ?? "-"}</dd></div>
          <div><dt>Due date</dt><dd>{String(invoice.due_date)}</dd></div>
          <div><dt>Status</dt><dd>{managementStatus.replaceAll("_", " ")}</dd></div>
        </dl>
        <table className="school-document__table"><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>
          {(items ?? []).map((item, index) => <tr key={`${item.description}-${index}`}><td>{item.description}</td><td>{Number(item.quantity).toLocaleString()}</td><td>{formatCurrency(item.unit_price)}</td><td>{formatCurrency(item.amount)}</td></tr>)}
        </tbody></table>
        <dl className="school-document__totals">
          <div><dt>Total</dt><dd>{formatCurrency(invoice.subtotal)}</dd></div>
          <div><dt>Paid</dt><dd>{formatCurrency(invoice.paid_amount)}</dd></div>
          <div className="is-emphasis"><dt>Balance due</dt><dd>{formatCurrency(invoice.remaining_amount)}</dd></div>
        </dl>
        {invoice.notes && <p className="school-document__notes"><strong>Notes:</strong> {invoice.notes}</p>}
        <div className="school-document__signatures"><span>Received by</span><span>Authorized signature</span></div>
      </SchoolDocument>
    </main>;
  }

  if (type === "invoice") {
    const [{ data: invoice, error }, { data: items, error: itemsError }] = await Promise.all([
      supabase.from("fee_invoices").select("id,invoice_number,student_id,status,total,paid_amount,remaining_amount,due_date,discount,late_fee,notes,students(first_name,last_name,admission_number,student_identifier)").eq("id", id).eq("school_id", schoolId).maybeSingle(),
      supabase.from("fee_invoice_items").select("fee_type,description,amount,is_optional").eq("invoice_id", id).eq("school_id", schoolId).order("created_at"),
    ]);
    if (error || itemsError) throw new Error("Invoice document could not be loaded.");
    if (!invoice) notFound();
    const student = Array.isArray(invoice.students) ? invoice.students[0] : invoice.students;
    return <main className="school-document-page"><div className="school-document-toolbar no-print"><Link href="/finance/invoices">Back to invoices</Link><PrintAction label="Print invoice / Save PDF" /></div>
      <SchoolDocument school={school} title="Fee invoice" reference={String(invoice.invoice_number)} className="school-document--invoice">
        <dl className="school-document__facts">
          <div><dt>Student</dt><dd>{[student?.first_name, student?.last_name].filter(Boolean).join(" ") || "Student"}</dd></div>
          <div><dt>Student ID</dt><dd>{student?.student_identifier ?? "-"}</dd></div>
          <div><dt>Admission no.</dt><dd>{student?.admission_number ?? "-"}</dd></div>
          <div><dt>Due date</dt><dd>{String(invoice.due_date)}</dd></div>
          <div><dt>Status</dt><dd>{String(invoice.status).replaceAll("_", " ")}</dd></div>
        </dl>
        <table className="school-document__table"><thead><tr><th>Description</th><th>Type</th><th>Amount</th></tr></thead><tbody>
          {(items ?? []).map((item, index) => <tr key={`${item.fee_type}-${index}`}><td>{item.description || String(item.fee_type).replaceAll("_", " ")}</td><td>{String(item.fee_type).replaceAll("_", " ")}{item.is_optional ? " (optional)" : ""}</td><td>{formatCurrency(item.amount)}</td></tr>)}
        </tbody></table>
        <dl className="school-document__totals">
          <div><dt>Discount</dt><dd>{formatCurrency(invoice.discount)}</dd></div>
          <div><dt>Late fee</dt><dd>{formatCurrency(invoice.late_fee)}</dd></div>
          <div><dt>Total</dt><dd>{formatCurrency(invoice.total)}</dd></div>
          <div><dt>Paid</dt><dd>{formatCurrency(invoice.paid_amount)}</dd></div>
          <div className="is-emphasis"><dt>Balance due</dt><dd>{formatCurrency(invoice.remaining_amount)}</dd></div>
        </dl>
        {invoice.notes && <p className="school-document__notes"><strong>Notes:</strong> {invoice.notes}</p>}
        <div className="school-document__signatures"><span>Received by</span><span>Authorized signature</span></div>
      </SchoolDocument>
    </main>;
  }

  if (type === "payment") {
    const { data: payment, error } = await supabase.from("fee_payments").select("id,payment_reference,invoice_id,amount,payment_method,payment_date,notes").eq("id", id).eq("school_id", schoolId).maybeSingle();
    if (error) throw new Error("Payment receipt could not be loaded.");
    if (!payment) notFound();
    const { data: invoice, error: invoiceError } = await supabase.from("fee_invoices").select("invoice_number,student_id").eq("id", payment.invoice_id).eq("school_id", schoolId).maybeSingle();
    if (invoiceError) throw new Error("Payment invoice details could not be loaded.");
    if (!invoice) notFound();
    const { data: student, error: studentError } = await supabase.from("students").select("first_name,last_name,admission_number,student_identifier").eq("school_id", schoolId).eq("id", invoice.student_id).maybeSingle();
    if (studentError) throw new Error("Payment student details could not be loaded.");
    return <main className="school-document-page"><div className="school-document-toolbar no-print"><Link href="/finance/payments">Back to payments</Link><PrintAction label="Print receipt / Save PDF" /></div>
      <SchoolDocument school={school} title="Fee payment receipt" reference={String(payment.payment_reference)}>
        <dl className="school-document__facts">
          <div><dt>Received from</dt><dd>{[student?.first_name, student?.last_name].filter(Boolean).join(" ") || "Student"}</dd></div>
          <div><dt>Student ID</dt><dd>{student?.student_identifier ?? "-"}</dd></div>
          <div><dt>Admission no.</dt><dd>{student?.admission_number ?? "-"}</dd></div>
          <div><dt>Invoice</dt><dd>{invoice.invoice_number}</dd></div>
          <div><dt>Payment date</dt><dd>{String(payment.payment_date)}</dd></div>
          <div><dt>Payment method</dt><dd>{String(payment.payment_method).replaceAll("_", " ")}</dd></div>
        </dl>
        <div className="school-document__receipt-amount"><span>Amount received</span><strong>{formatCurrency(payment.amount)}</strong></div>
        {payment.notes && <p className="school-document__notes"><strong>Notes:</strong> {payment.notes}</p>}
        <p className="school-document__notice">This receipt confirms the payment recorded against the invoice shown above.</p>
        <div className="school-document__signatures"><span>Cashier / receiver</span><span>Parent / guardian</span></div>
      </SchoolDocument>
    </main>;
  }

  const { data: expense, error } = await supabase.from("school_expenses").select("id,category,description,vendor,amount,payment_method,expense_date,reference,notes").eq("id", id).eq("school_id", schoolId).maybeSingle();
  if (error) throw new Error("Expense voucher could not be loaded.");
  if (!expense) notFound();
  return <main className="school-document-page"><div className="school-document-toolbar no-print"><Link href="/finance/expenses">Back to expenses</Link><PrintAction label="Print voucher / Save PDF" /></div>
    <SchoolDocument school={school} title="Expense voucher" reference={String(expense.reference ?? expense.id)}>
      <dl className="school-document__facts">
        <div><dt>Expense date</dt><dd>{String(expense.expense_date)}</dd></div>
        <div><dt>Category</dt><dd>{String(expense.category).replaceAll("_", " ")}</dd></div>
        <div><dt>Payee</dt><dd>{expense.vendor || "-"}</dd></div>
        <div><dt>Payment method</dt><dd>{String(expense.payment_method).replaceAll("_", " ")}</dd></div>
        <div><dt>Description</dt><dd>{expense.description}</dd></div>
      </dl>
      <div className="school-document__receipt-amount"><span>Amount paid</span><strong>{formatCurrency(expense.amount)}</strong></div>
      {expense.notes && <p className="school-document__notes"><strong>Notes:</strong> {expense.notes}</p>}
      <div className="school-document__signatures"><span>Prepared by</span><span>Approved by</span></div>
    </SchoolDocument>
  </main>;
}
