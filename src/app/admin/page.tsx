import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { requireMasterAdmin } from "@/lib/admin/guard";
import { formatCurrency } from "@/lib/format/currency";
import { formatStorageBytes, getStorageQuotaStatus } from "@/lib/storage/quota";

function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Record<string, unknown> =>
    Boolean(row && typeof row === "object" && !Array.isArray(row))
  );
}

export default async function AdminOverviewPage() {
  const { supabase } = await requireMasterAdmin();
  const [{ data: schools }, { data: roles }, { data: accountSummary, error: accountSummaryError }, { data: students }, { data: teachers }, { data: staff }, { data: bills }, { data: transactions }, { data: documents }, { data: quotas }, { data: audit }, { data: contracts }, { data: trials }] = await Promise.all([
    supabase.from("schools").select("id,name,is_active,created_at").order("created_at", { ascending: false }),
    supabase.from("user_roles").select("user_id,school_id"),
    supabase.rpc("get_account_management_summary"),
    supabase.from("students").select("id,school_id"),
    supabase.from("teachers").select("id,school_id"),
    supabase.from("staff").select("id,school_id"),
    supabase.from("platform_bills").select("id,total_amount,paid_amount,status,due_date,school_id"),
    supabase.from("platform_transactions").select("id,amount,transaction_date,school_id"),
    supabase.from("school_documents").select("id,file_size,school_id"),
    supabase.from("school_storage_quotas").select("school_id,quota_bytes,warning_threshold,is_active"),
    supabase.from("audit_logs").select("id,action,entity_type,created_at,school_id").order("created_at", { ascending: false }).limit(6),
    supabase.from("platform_contracts").select("id,status,plan_name,monthly_amount,school_id").order("created_at", { ascending: false }).limit(6),
    supabase.from("school_trials").select("id,status,trial_name,seats,school_id").order("starts_on", { ascending: false }).limit(6),
  ]);
  const schoolRows = schools ?? [];
  const activeSchools = schoolRows.filter((school) => school.is_active).length;
  const billsRows = bills ?? [];
  const outstanding = billsRows.reduce((sum, bill) => sum + Math.max(Number(bill.total_amount ?? 0) - Number(bill.paid_amount ?? 0), 0), 0);
  const received = (transactions ?? []).reduce((sum, transaction) => sum + Number(transaction.amount ?? 0), 0);
  const storageUsed = (documents ?? []).reduce((sum, document) => sum + Number(document.file_size ?? 0), 0);
  const totalQuota = (quotas ?? []).reduce((sum, quota) => sum + Number(quota.quota_bytes ?? 0), 0);
  const storageSummary = getStorageQuotaStatus(storageUsed, totalQuota || null);
  const attention = [
    { label: "Active schools", value: activeSchools, tone: "positive" },
    { label: "Inactive schools", value: schoolRows.length - activeSchools, tone: schoolRows.length - activeSchools ? "warning" : "positive" },
    { label: "Schools with overdue bills", value: new Set(billsRows.filter((bill) => String(bill.status) === "overdue").map((bill) => bill.school_id)).size, tone: "warning" },
    { label: "Recent audit activity", value: (audit ?? []).length, tone: "neutral" },
  ];

  return <AdminShell title="Admin Overview" description="A global operating view of the Schooliva platform. Select a school only when you need to enter its environment." breadcrumbs={[{ label: "Overview" }]}>
    <section className="admin-kpi-grid">
        <article className="admin-kpi"><span>Total schools</span><strong>{schoolRows.length}</strong><small>Live database value</small></article>
        <article className="admin-kpi"><span>Active schools</span><strong>{activeSchools}</strong><small>Live database value</small></article>
      {[
        ["Total accounts", accountSummaryError ? "Unavailable" : String((accountSummary as Record<string, unknown> | null)?.total_accounts ?? 0)],
        ["Active accounts", accountSummaryError ? "Unavailable" : String((accountSummary as Record<string, unknown> | null)?.active_accounts ?? 0)],
        ["Inactive accounts", accountSummaryError ? "Unavailable" : String((accountSummary as Record<string, unknown> | null)?.inactive_accounts ?? 0)],
        ["Suspended accounts", accountSummaryError ? "Unavailable" : String((accountSummary as Record<string, unknown> | null)?.suspended_accounts ?? 0)],
        ["Students", (students ?? []).length],
        ["Teachers & staff", (teachers ?? []).length + (staff ?? []).length],
        ["Outstanding", formatCurrency(outstanding)],
        ["Payments received", formatCurrency(received)],
      ].map(([label, value]) => <article className="admin-kpi" key={String(label)}><span>{String(label)}</span><strong>{String(value)}</strong><small>{accountSummaryError && String(label).includes("account") ? "Account summary unavailable" : "Live database value"}</small></article>)}
    </section>
    {accountSummaryError && <p className="auth-error">Account statistics could not be loaded from the database.</p>}
    {!accountSummaryError && <section className="admin-grid admin-grid--two account-dashboard-grid" aria-label="Account activity overview">
      <section className="admin-panel">
        <div className="admin-panel__heading"><div><p className="admin-kicker">Accounts by school</p><h2>School membership totals</h2></div></div>
        <div className="admin-health-list">
          {records((accountSummary as Record<string, unknown> | null)?.accounts_by_school).map((row) => <div className="admin-health-row" key={String(row.school_id)}><strong>{String(row.school_name)}</strong><b>{String(row.count)}</b></div>)}
          {!records((accountSummary as Record<string, unknown> | null)?.accounts_by_school).length && <p className="dashboard-muted">No school memberships are recorded.</p>}
        </div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel__heading"><div><p className="admin-kicker">Accounts by role</p><h2>Assigned roles</h2></div></div>
        <div className="admin-health-list">
          {records((accountSummary as Record<string, unknown> | null)?.accounts_by_role).map((row) => <div className="admin-health-row" key={`${String(row.role_id)}-${String(row.school_id)}`}><strong>{String(row.role_name)}</strong><b>{String(row.count)}</b></div>)}
          {!records((accountSummary as Record<string, unknown> | null)?.accounts_by_role).length && <p className="dashboard-muted">No role assignments are recorded.</p>}
        </div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel__heading"><div><p className="admin-kicker">Recently created</p><h2>New accounts</h2></div></div>
        <div className="admin-health-list">
          {records((accountSummary as Record<string, unknown> | null)?.recent_created).map((row) => <Link className="admin-health-row" href={`/admin/accounts/${String(row.id)}`} key={String(row.id)}><strong>{String(row.full_name ?? "Unnamed account")}</strong><b>{new Date(String(row.created_at)).toLocaleDateString()}</b></Link>)}
          {!records((accountSummary as Record<string, unknown> | null)?.recent_created).length && <p className="dashboard-muted">No recent account creation activity.</p>}
        </div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel__heading"><div><p className="admin-kicker">Recently updated</p><h2>Profile changes</h2></div></div>
        <div className="admin-health-list">
          {records((accountSummary as Record<string, unknown> | null)?.recent_updated).map((row) => <Link className="admin-health-row" href={`/admin/accounts/${String(row.id)}`} key={String(row.id)}><strong>{String(row.full_name ?? "Unnamed account")}</strong><b>{new Date(String(row.updated_at)).toLocaleDateString()}</b></Link>)}
          {!records((accountSummary as Record<string, unknown> | null)?.recent_updated).length && <p className="dashboard-muted">No recent profile changes.</p>}
        </div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel__heading"><div><p className="admin-kicker">Security activity</p><h2>Recent account events</h2></div></div>
        <div className="admin-health-list">
          {records((accountSummary as Record<string, unknown> | null)?.recent_security_events).map((row, index) => <Link className="admin-health-row" href={row.target_user_id ? `/admin/accounts/${String(row.target_user_id)}` : "/admin/accounts"} key={String(row.id ?? index)}><strong>{String(row.action)} · {String(row.result)}</strong><b>{new Date(String(row.created_at)).toLocaleString()}</b></Link>)}
          {!records((accountSummary as Record<string, unknown> | null)?.recent_security_events).length && <p className="dashboard-muted">No account security events have been recorded.</p>}
        </div>
      </section>
    </section>}
    <div className="admin-grid admin-grid--two">
      <section className="admin-panel"><div className="admin-panel__heading"><div><p className="admin-kicker">Platform health</p><h2>What needs attention</h2></div><span className="admin-status-dot"><i /> Operational</span></div><div className="admin-health-list">{attention.map((item) => <div className="admin-health-row" key={item.label}><span className={`admin-health-icon ${item.tone}`} /> <strong>{item.label}</strong><b>{item.value}</b></div>)}</div></section>
      <section className="admin-panel"><div className="admin-panel__heading"><div><p className="admin-kicker">Usage footprint</p><h2>Platform volume</h2></div></div><div className="admin-usage-stat"><span>Document storage recorded</span><strong>{formatStorageBytes(storageUsed)}</strong><small>{storageSummary.status === "unlimited" ? "No platform quota is configured yet." : `Used ${storageSummary.percentage.toFixed(0)}% of ${formatStorageBytes(totalQuota)} total quota.`}</small></div><div className="admin-usage-stat"><span>Open platform bills</span><strong>{billsRows.filter((bill) => String(bill.status) !== "paid").length}</strong><small>Across all schools with platform bills.</small></div></section>
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
