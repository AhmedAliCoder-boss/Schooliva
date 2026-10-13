import Link from "next/link";

import { hasFinanceView, requireFinanceContext } from "@/lib/finance/context";
import { formatCurrency } from "@/lib/format/currency";

const financeSections = [
  { href: "/finance/fees", number: "01", title: "Fee structures", description: "Add and review class-wise fees, amounts, and billing frequency.", action: "Manage fees" },
  { href: "/finance/invoices", number: "02", title: "Invoices", description: "Create student invoices and review balances due.", action: "Manage invoices" },
  { href: "/finance/payments", number: "03", title: "Payments", description: "Record collections and review transaction history.", action: "Manage payments" },
  { href: "/finance/expenses", number: "04", title: "Expenses", description: "Log school spending and keep operating costs organized.", action: "Manage expenses" },
];

export default async function FinancePage() {
  const { supabase, schoolId } = await requireFinanceContext("view");
  const [{ data: invoices, error: invoiceError }, { count: feeCount, error: feeError }, canViewExpenses] = await Promise.all([
    supabase.from("fee_invoices").select("total,paid_amount,remaining_amount,status").eq("school_id", schoolId),
    supabase.from("fee_structures").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("is_active", true),
    hasFinanceView(supabase, schoolId, "finance"),
  ]);
  if (invoiceError || feeError) throw new Error("Finance overview data could not be loaded.");
  const { data: expenses, error: expenseError } = canViewExpenses
    ? await supabase.from("school_expenses").select("amount").eq("school_id", schoolId)
    : { data: [], error: null };
  if (expenseError) throw new Error("Expense summary could not be loaded.");
  const invoiceRows = invoices ?? [];
  const expenseRows = expenses ?? [];
  const collected = invoiceRows.reduce((sum, invoice) => sum + Number(invoice.paid_amount ?? 0), 0);
  const outstanding = invoiceRows.reduce((sum, invoice) => sum + Number(invoice.remaining_amount ?? 0), 0);
  const expenseTotal = expenseRows.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);

  return <main className="students-shell finance-shell">
    <section className="module-page-header">
      <div className="module-page-header__row"><div>
        <p className="module-page-header__eyebrow">Finance department</p>
        <h1>Finance workspace</h1>
        <p>Choose a task to manage fees, billing, collections, or school expenses.</p>
      </div></div>
    </section>
    <section className={`finance-kpi-grid ${canViewExpenses ? "" : "finance-kpi-grid--limited"}`} aria-label="Finance summary">
      <article className="module-kpi"><span>Collected</span><strong>{formatCurrency(collected)}</strong></article>
      <article className="module-kpi"><span>Outstanding</span><strong>{formatCurrency(outstanding)}</strong></article>
      <article className="module-kpi"><span>Active fee structures</span><strong>{feeCount ?? 0}</strong></article>
      {canViewExpenses && <article className="module-kpi"><span>Recorded expenses</span><strong>{formatCurrency(expenseTotal)}</strong></article>}
    </section>
    <section className="finance-directory" aria-labelledby="finance-directory-title">
      <header className="finance-section-heading"><div><p className="module-page-header__eyebrow">Department tools</p><h2 id="finance-directory-title">Work by section</h2></div><p>Each section keeps its forms and records together.</p></header>
      <div className="finance-directory__grid">
        {financeSections.map((section) => <Link key={section.href} href={section.href} className="finance-directory-card">
          <span className="finance-directory-card__number">{section.number}</span>
          <span className="finance-directory-card__body"><strong>{section.title}</strong><small>{section.description}</small><em>{section.action}<span aria-hidden="true"> →</span></em></span>
        </Link>)}
      </div>
    </section>
  </main>;
}
