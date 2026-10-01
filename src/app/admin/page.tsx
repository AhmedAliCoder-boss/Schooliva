import Link from "next/link";

import { AdminShell, AdminUnavailable } from "@/components/admin/admin-shell";
import { requireMasterAdmin } from "@/lib/admin/guard";
import { formatCurrency } from "@/lib/format/currency";
import { formatStorageBytes, getStorageQuotaStatus } from "@/lib/storage/quota";

export default async function AdminOverviewPage() {
  const { supabase } = await requireMasterAdmin();
  const [{ data: schools }, { data: roles }, { data: profiles }, { data: students }, { data: teachers }, { data: staff }, { data: invoices }, { data: payments }, { data: documents }, { data: quotas }, { data: audit }, { data: contracts }, { data: trials }] = await Promise.all([
    supabase.from("schools").select("id,name,is_active,created_at").order("created_at", { ascending: false }),
    supabase.from("user_roles").select("user_id,school_id"),
    supabase.from("profiles").select("id,is_active"),
    supabase.from("students").select("id,school_id"),
    supabase.from("teachers").select("id,school_id"),
    supabase.from("staff").select("id,school_id"),
    supabase.from("fee_invoices").select("id,total,paid_amount,remaining_amount,status,due_date,school_id"),
    supabase.from("fee_payments").select("id,amount,payment_date,school_id"),
    supabase.from("school_documents").select("id,file_size,school_id"),
    supabase.from("school_storage_quotas").select("school_id,quota_bytes,warning_threshold,is_active"),
    supabase.from("audit_logs").select("id,action,entity_type,created_at,school_id").order("created_at", { ascending: false }).limit(6),
    supabase.from("platform_contracts").select("id,status,plan_name,monthly_amount,school_id").order("created_at", { ascending: false }).limit(6),
    supabase.from("school_trials").select("id,status,trial_name,seats,school_id").order("starts_on", { ascending: false }).limit(6),
  ]);
  const schoolRows = schools ?? [];
  const profileMap = new Map((profiles ?? []).map((profile) => [String(profile.id), profile]));
  const accountIds = new Set((roles ?? []).map((role) => String(role.user_id)));
  const activeAccounts = [...accountIds].filter((id) => profileMap.get(id)?.is_active).length;
  const activeSchools = schoolRows.filter((school) => school.is_active).length;
  const invoicesRows = invoices ?? [];
  const outstanding = invoicesRows.reduce((sum, invoice) => sum + Number(invoice.remaining_amount ?? 0), 0);
  const received = (payments ?? []).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const storageUsed = (documents ?? []).reduce((sum, document) => sum + Number(document.file_size ?? 0), 0);
  const quotaMap = new Map((quotas ?? []).map((quota) => [String(quota.school_id), quota]));
  const totalQuota = (quotas ?? []).reduce((sum, quota) => sum + Number(quota.quota_bytes ?? 0), 0);
  const storageSummary = getStorageQuotaStatus(storageUsed, totalQuota || null);
  const attention = [
    { label: "Active schools", value: activeSchools, tone: "positive" },
    { label: "Inactive schools", value: schoolRows.length - activeSchools, tone: schoolRows.length - activeSchools ? "warning" : "positive" },
    { label: "Schools with overdue invoices", value: new Set(invoicesRows.filter((invoice) => String(invoice.status) === "overdue").map((invoice) => invoice.school_id)).size, tone: "warning" },
    { label: "Recent audit activity", value: (audit ?? []).length, tone: "neutral" },
  ];

  return <AdminShell title="Admin Overview" description="A global operating view of the Schooliva platform. Select a school only when you need to enter its environment." breadcrumbs={[{ label: "Overview" }]}>
    <section className="admin-kpi-grid">
      {[["Total schools", schoolRows.length], ["Active schools", activeSchools], ["Total accounts", accountIds.size], ["Active accounts", activeAccounts], ["Students", (students ?? []).length], ["Teachers & staff", (teachers ?? []).length + (staff ?? []).length], ["Outstanding", formatCurrency(outstanding)], ["Payments received", formatCurrency(received)]].map(([label, value]) => <article className="admin-kpi" key={String(label)}><span>{String(label)}</span><strong>{String(value)}</strong><small>Live database value</small></article>)}
    </section>
    <div className="admin-grid admin-grid--two">
      <section className="admin-panel"><div className="admin-panel__heading"><div><p className="admin-kicker">Platform health</p><h2>What needs attention</h2></div><span className="admin-status-dot"><i /> Operational</span></div><div className="admin-health-list">{attention.map((item) => <div className="admin-health-row" key={item.label}><span className={`admin-health-icon ${item.tone}`} /> <strong>{item.label}</strong><b>{item.value}</b></div>)}</div></section>
      <section className="admin-panel"><div className="admin-panel__heading"><div><p className="admin-kicker">Usage footprint</p><h2>Platform volume</h2></div></div><div className="admin-usage-stat"><span>Document storage recorded</span><strong>{formatStorageBytes(storageUsed)}</strong><small>{storageSummary.status === "unlimited" ? "No platform quota is configured yet." : `Used ${storageSummary.percentage.toFixed(0)}% of ${formatStorageBytes(totalQuota)} total quota.`}</small></div><div className="admin-usage-stat"><span>Open invoices</span><strong>{invoicesRows.filter((invoice) => String(invoice.status) !== "paid").length}</strong><small>Across all schools with finance records.</small></div></section>
    </div>
    <section className="admin-panel"><div className="admin-panel__heading"><div><p className="admin-kicker">School portfolio</p><h2>Recently created schools</h2></div><Link className="admin-link" href="/admin/schools">View all schools →</Link></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>School</th><th>Status</th><th>Created</th><th>Students</th><th>Accounts</th><th /></tr></thead><tbody>{schoolRows.slice(0, 6).map((school) => <tr key={school.id}><td><Link className="admin-table__primary" href={`/admin/schools/${school.id}`}>{school.name}</Link></td><td><span className={`admin-badge ${school.is_active ? "admin-badge--positive" : "admin-badge--warning"}`}>{school.is_active ? "Active" : "Inactive"}</span></td><td>{new Date(String(school.created_at)).toLocaleDateString()}</td><td>{(students ?? []).filter((student) => student.school_id === school.id).length}</td><td>{new Set((roles ?? []).filter((role) => role.school_id === school.id).map((role) => role.user_id)).size}</td><td><Link className="admin-table__action" href={`/admin/schools/${school.id}`}>Open →</Link></td></tr>)}{!schoolRows.length && <tr><td colSpan={6}>No schools found.</td></tr>}</tbody></table></div></section>
    <div className="admin-grid admin-grid--two">
      <section className="admin-panel">
        <div className="admin-panel__heading">
          <div><p className="admin-kicker">Contracts & trials</p><h2>Tenant lifecycle</h2></div>
        </div>
        <div className="admin-health-list">
          <div className="admin-health-row"><strong>Active contracts</strong><b>{(contracts ?? []).filter((contract) => String(contract.status) === "active").length}</b></div>
          <div className="admin-health-row"><strong>Pending trials</strong><b>{(trials ?? []).filter((trial) => String(trial.status) === "pending").length}</b></div>
          <div className="admin-health-row"><strong>Recent plan value</strong><b>{formatCurrency((contracts ?? []).reduce((sum, contract) => sum + Number(contract.monthly_amount ?? 0), 0))}</b></div>
          <div className="admin-health-row"><strong>Live trial seats</strong><b>{(trials ?? []).reduce((sum, trial) => sum + Number(trial.seats ?? 0), 0)}</b></div>
        </div>
      </section>
      <section className="admin-panel"><div className="admin-panel__heading"><div><p className="admin-kicker">Quick actions</p><h2>Move through the platform</h2></div></div><div className="admin-action-list"><Link href="/admin/schools">Manage schools <span>→</span></Link><Link href="/admin/accounts">Review accounts <span>→</span></Link><Link href="/admin/billing">Open billing overview <span>→</span></Link></div></section>
    </div>
  </AdminShell>;
}
