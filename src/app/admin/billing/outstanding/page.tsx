import { AdminShell } from "@/components/admin/admin-shell";
import { filterCustomerSchoolRows } from "@/lib/admin/customer-schools";
import { reconcileInvoiceStatus } from "@/lib/billing-reconciliation";
import { requireMasterAdmin } from "@/lib/admin/guard";
import { formatCurrency } from "@/lib/format/currency";

function relation<T>(value: unknown): T | null { return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null; }

export default async function OutstandingPage() {
  const { supabase } = await requireMasterAdmin();
  const [{ data: bills }, { data: schools }] = await Promise.all([
    supabase.from("platform_bills").select("id,bill_number,total_amount,paid_amount,due_date,status,school_id,schools(name)").order("due_date"),
    supabase.from("schools").select("id"),
  ]);
  const schoolIds = (schools ?? []).map((school) => school.id);
  const rows = filterCustomerSchoolRows(bills ?? [], schoolIds).map((bill) => ({
    ...bill,
    balance: reconcileInvoiceStatus({
      total: Number(bill.total_amount ?? 0),
      paidAmount: Number(bill.paid_amount ?? 0),
      dueDate: String(bill.due_date ?? ""),
    }),
  })).filter((bill) => bill.balance.remainingAmount > 0);
  const today = new Date();
  return <AdminShell title="Outstanding / Dues" description="Unpaid platform bills for schools, ordered by due date." breadcrumbs={[{ label: "Billing", href: "/admin/billing" }, { label: "Outstanding / Dues" }]}><section className="admin-panel admin-panel--flush"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>School</th><th>Bill</th><th>Outstanding</th><th>Due date</th><th>Days overdue</th><th>Status</th></tr></thead><tbody>{rows.map((bill) => { const due = new Date(String(bill.due_date)); const days = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000)); return <tr key={bill.id}><td>{relation<{ name?: string }>(bill.schools)?.name ?? "-"}</td><td>{bill.bill_number}</td><td>{formatCurrency(bill.balance.remainingAmount)}</td><td>{String(bill.due_date)}</td><td>{days}</td><td><span className={`admin-badge ${bill.balance.status === "overdue" ? "admin-badge--warning" : "admin-badge--neutral"}`}>{bill.balance.status.replaceAll("_", " ")}</span></td></tr>; })}{!rows.length && <tr><td colSpan={6}>No outstanding school bills found.</td></tr>}</tbody></table></div></section></AdminShell>;
}
