import { FinanceOverviewDashboard } from "@/components/finance/finance-overview-dashboard";
import { hasFinanceView, requireFinanceContext } from "@/lib/finance/context";

const PAGE_SIZE = 1000;

async function loadInvoiceSummary(supabase: Awaited<ReturnType<typeof requireFinanceContext>>["supabase"], schoolId: string) {
  const rows: { total: number; paid_amount: number; remaining_amount: number; status: string; due_date: string; created_at: string }[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase.from("fee_invoices")
      .select("total,paid_amount,remaining_amount,status,due_date,created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .range(start, start + PAGE_SIZE - 1);
    if (error) throw new Error("Finance invoice summary could not be loaded.");
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function loadCollections(
  supabase: Awaited<ReturnType<typeof requireFinanceContext>>["supabase"],
  schoolId: string,
  fromDate: string,
) {
  const rows: { id: string; payment_reference: string; invoice_id: string; amount: number; payment_method: string; payment_date: string }[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase.from("fee_payments")
      .select("id,payment_reference,invoice_id,amount,payment_method,payment_date")
      .eq("school_id", schoolId)
      .gte("payment_date", fromDate)
      .order("payment_date", { ascending: false })
      .range(start, start + PAGE_SIZE - 1);
    if (error) throw new Error("Finance collection trends could not be loaded.");
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function loadExpenses(
  supabase: Awaited<ReturnType<typeof requireFinanceContext>>["supabase"],
  schoolId: string,
  fromDate: string,
) {
  const rows: { amount: number; expense_date: string }[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase.from("school_expenses")
      .select("amount,expense_date")
      .eq("school_id", schoolId)
      .gte("expense_date", fromDate)
      .order("expense_date", { ascending: false })
      .range(start, start + PAGE_SIZE - 1);
    if (error) throw new Error("Finance expense trends could not be loaded.");
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export default async function FinancePage() {
  const { supabase, schoolId } = await requireFinanceContext("view");
  const asOfDate = new Date().toISOString().slice(0, 10);
  const twoYearsAgo = new Date(`${asOfDate}T00:00:00.000Z`);
  twoYearsAgo.setUTCDate(twoYearsAgo.getUTCDate() - 730);
  const fromDate = twoYearsAgo.toISOString().slice(0, 10);
  const [invoices, collections, { count: feeCount, error: feeError }, canViewExpenses] = await Promise.all([
    loadInvoiceSummary(supabase, schoolId),
    loadCollections(supabase, schoolId, fromDate),
    supabase.from("fee_structures").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("is_active", true),
    hasFinanceView(supabase, schoolId, "finance"),
  ]);
  if (feeError) throw new Error("Active fee structures could not be counted.");
  const expenses = canViewExpenses ? await loadExpenses(supabase, schoolId, fromDate) : [];

  return <main className="students-shell finance-shell finance-overview-shell">
    <FinanceOverviewDashboard
      asOfDate={asOfDate}
      invoices={invoices.map((invoice) => ({
        total: Number(invoice.total ?? 0),
        paidAmount: Number(invoice.paid_amount ?? 0),
        remainingAmount: Number(invoice.remaining_amount ?? 0),
        status: String(invoice.status),
        dueDate: String(invoice.due_date),
        createdAt: String(invoice.created_at),
      }))}
      collections={collections.map((payment) => ({
        id: String(payment.id),
        reference: String(payment.payment_reference),
        invoiceId: String(payment.invoice_id),
        amount: Number(payment.amount),
        method: String(payment.payment_method),
        date: String(payment.payment_date),
      }))}
      expenses={expenses.map((expense) => ({
        amount: Number(expense.amount),
        date: String(expense.expense_date),
      }))}
      activeFeeCount={feeCount ?? 0}
      canViewExpenses={canViewExpenses}
    />
  </main>;
}
