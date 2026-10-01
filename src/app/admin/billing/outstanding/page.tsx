import { AdminShell } from "@/components/admin/admin-shell";
import { requireMasterAdmin } from "@/lib/admin/guard";
import { formatCurrency } from "@/lib/format/currency";

function relation<T>(value: unknown): T | null { return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null; }

export default async function OutstandingPage() {
  const { supabase } = await requireMasterAdmin();
  const { data } = await supabase.from("fee_invoices").select("id,invoice_number,remaining_amount,due_date,status,school_id,schools(name)").gt("remaining_amount", 0).order("due_date");
  const today = new Date();
  return <AdminShell title="Outstanding / Dues" description="Invoices with a remaining balance, ordered by due date." breadcrumbs={[{ label: "Billing", href: "/admin/billing" }, { label: "Outstanding / Dues" }]}><section className="admin-panel admin-panel--flush"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>School</th><th>Invoice</th><th>Outstanding</th><th>Due date</th><th>Days overdue</th><th>Status</th></tr></thead><tbody>{(data ?? []).map((invoice) => { const due = new Date(String(invoice.due_date)); const days = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000)); return <tr key={invoice.id}><td>{relation<{ name?: string }>(invoice.schools)?.name ?? "-"}</td><td>{invoice.invoice_number}</td><td>{formatCurrency(invoice.remaining_amount)}</td><td>{String(invoice.due_date)}</td><td>{days}</td><td><span className={`admin-badge ${days ? "admin-badge--warning" : "admin-badge--neutral"}`}>{days ? "Overdue" : String(invoice.status).replaceAll("_", " ")}</span></td></tr>; })}{!(data ?? []).length && <tr><td colSpan={6}>No outstanding invoices found.</td></tr>}</tbody></table></div></section></AdminShell>;
}
