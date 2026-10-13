import Link from "next/link";

import { ExpenseForm } from "@/components/finance/finance-forms";
import { FinanceFormDisclosure } from "@/components/finance/finance-form-disclosure";
import { canManageFinance, requireFinanceContext } from "@/lib/finance/context";
import { formatCurrency } from "@/lib/format/currency";

export default async function FinanceExpensesPage() {
  const { supabase, schoolId } = await requireFinanceContext("view", "finance");
  const [{ data: expenses, error }, canManage] = await Promise.all([
    supabase.from("school_expenses").select("id,category,description,vendor,amount,payment_method,expense_date,reference,notes").eq("school_id", schoolId).order("expense_date", { ascending: false }),
    canManageFinance(supabase, schoolId, "finance"),
  ]);
  if (error) throw new Error("Expense records could not be loaded. Apply the school expenses migration first.");
  const rows = expenses ?? [];
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);

  return <main className="students-shell finance-shell">
    <section className="module-page-header"><div className="module-page-header__row"><div>
      <p className="module-page-header__eyebrow">Finance / Spending</p><h1>Expenses</h1>
      <p>Record school operating costs and keep every outgoing payment in one register.</p>
    </div></div></section>
    <section className="finance-expense-summary" aria-label="Expense summary"><article className="module-kpi"><span>Total recorded expenses</span><strong>{formatCurrency(total)}</strong></article><article className="module-kpi"><span>Expense entries</span><strong>{rows.length}</strong></article></section>
    <section className="finance-work-grid">
      {canManage && <FinanceFormDisclosure label="Outgoing payment" title="Add expense" description="Save the category, payee, amount, and payment reference."><ExpenseForm /></FinanceFormDisclosure>}
      <section className="finance-work-card finance-work-card--records" aria-labelledby="expense-list-title">
        <header className="finance-work-card__heading"><div><span className="dashboard-panel-kicker">Expense register</span><h2 id="expense-list-title">Recorded expenses</h2><p>{rows.length} expense entries</p></div></header>
        <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Vendor / payee</th><th>Method</th><th>Reference</th><th>Amount</th><th className="no-print">Document</th></tr></thead><tbody>{rows.length ? rows.map((expense) => <tr key={String(expense.id)}><td>{String(expense.expense_date)}</td><td>{String(expense.category).replaceAll("_", " ")}</td><td>{String(expense.description)}</td><td>{expense.vendor ?? "-"}</td><td>{String(expense.payment_method).replaceAll("_", " ")}</td><td>{expense.reference ?? "-"}</td><td>{formatCurrency(expense.amount)}</td><td className="no-print"><Link className="school-document-link" href={`/finance/print/expense/${expense.id}`}>Voucher / PDF</Link></td></tr>) : <tr><td colSpan={8}><div className="student-empty"><h3>No expenses recorded</h3><p>Add an expense to begin the school spending register.</p></div></td></tr>}</tbody></table></div>
      </section>
    </section>
  </main>;
}
