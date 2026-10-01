import Link from "next/link";

import { cancelSchoolContract, createPlatformContract, createSchoolTrial, pauseSchoolContract, recordSchoolPayment, reconcileBillingInvoices, renewSchoolContract } from "@/app/actions/admin";
import { AdminShell, AdminUnavailable } from "@/components/admin/admin-shell";
import { filterCustomerSchoolRows } from "@/lib/admin/customer-schools";
import { requireMasterAdmin } from "@/lib/admin/guard";
import { formatCurrency } from "@/lib/format/currency";
import { describeContractLifecycle } from "@/lib/billing-lifecycle";
import { reconcileInvoiceStatus } from "@/lib/billing-reconciliation";
import { resolveContractRenewalWindow } from "@/lib/contract-renewal";
import { formatStorageBytes, getStorageQuotaStatus } from "@/lib/storage/quota";

function relation<T>(value: unknown): T | null { return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null; }

async function AccountsPage() {
  const { supabase } = await requireMasterAdmin();
  const [{ data: memberships }, { data: profiles }] = await Promise.all([
    supabase.from("user_roles").select("user_id,school_id,created_at,roles(name,slug),schools(name)"),
    supabase.from("profiles").select("id,full_name,email,is_active,created_at"),
  ]);
  const profileMap = new Map((profiles ?? []).map((profile) => [String(profile.id), profile]));
  return <AdminShell title="Accounts" description="Global account visibility across every school. Master Admin identities are never offered as editable records here." breadcrumbs={[{ label: "Accounts" }]}><section className="admin-panel admin-panel--flush"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Account</th><th>School</th><th>Role</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>{(memberships ?? []).map((membership) => { const profile = profileMap.get(String(membership.user_id)); const role = relation<{ name?: string; slug?: string }>(membership.roles); const school = relation<{ name?: string }>(membership.schools); const master = role?.slug === "super_admin"; return <tr key={`${membership.user_id}-${membership.school_id}`}><td><strong>{profile?.full_name ?? "Unnamed account"}</strong><small>{profile?.email ?? String(membership.user_id).slice(0, 12)}</small></td><td>{school?.name ?? "-"}</td><td>{role?.name ?? role?.slug ?? "-"}</td><td><span className={`admin-badge ${profile?.is_active ? "admin-badge--positive" : "admin-badge--warning"}`}>{profile?.is_active ? "Active" : "Inactive"}</span></td><td>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "-"}</td><td>{master ? <span className="admin-note">Protected</span> : <span className="admin-note">Scoped actions stay in school management</span>}</td></tr>; })}</tbody></table></div></section></AdminShell>;
}

async function BillingPage({ payments = false }: { payments?: boolean }) {
  const { supabase } = await requireMasterAdmin();
  if (payments) {
    const [{ data: paymentsData }, { data: outstandingInvoices }, { data: schools }] = await Promise.all([
      supabase.from("fee_payments").select("id,payment_reference,amount,payment_method,payment_date,school_id,schools(name)").order("payment_date", { ascending: false }).limit(100),
      supabase.from("fee_invoices").select("id,invoice_number,school_id,remaining_amount").gt("remaining_amount", 0).order("due_date", { ascending: true }),
      supabase.from("schools").select("id,name").order("name", { ascending: true }),
    ]);
    const customerSchoolIds = (schools ?? []).map((school) => school.id);
    const filteredPayments = filterCustomerSchoolRows(paymentsData ?? [], customerSchoolIds);
    const filteredOutstandingInvoices = filterCustomerSchoolRows(outstandingInvoices ?? [], customerSchoolIds);

    return <AdminShell title="Payments" description="Only customer-school billing records are shown here. Internal platform records are excluded from the finance ledger." breadcrumbs={[{ label: "Payments" }]}>
      <section className="admin-panel">
        <div className="admin-panel__heading">
          <div><p className="admin-kicker">Record payment</p><h2>Register a school payment</h2></div>
        </div>
        <form action={recordSchoolPayment} className="student-form" style={{ marginTop: 12 }}>
          <div className="student-form-grid">
            <label className="student-field">Invoice<select name="invoiceId" required>{filteredOutstandingInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} · {schools?.find((school) => school.id === invoice.school_id)?.name ?? "School"}</option>)}</select></label>
            <label className="student-field">Amount<input type="number" name="amount" min="0.01" step="0.01" required /></label>
            <label className="student-field">Method<select name="paymentMethod" defaultValue="bank_transfer"><option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option><option value="card">Card</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="other">Other</option></select></label>
            <label className="student-field">Payment date<input type="date" name="paymentDate" required /></label>
            <label className="student-field student-field-wide">Notes<textarea name="notes" rows={3} /></label>
          </div>
          <button type="submit" className="dashboard-action dashboard-action--primary">Record payment</button>
        </form>
      </section>
      <section className="admin-panel admin-panel--flush"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Reference</th><th>School</th><th>Amount</th><th>Method</th><th>Payment date</th><th>Status</th></tr></thead><tbody>{filteredPayments.map((payment) => <tr key={payment.id}><td>{payment.payment_reference}</td><td>{relation<{ name?: string }>(payment.schools)?.name ?? "-"}</td><td>{formatCurrency(payment.amount)}</td><td>{String(payment.payment_method).replaceAll("_", " ")}</td><td>{String(payment.payment_date)}</td><td><span className="admin-badge admin-badge--positive">Recorded</span></td></tr>)}{!filteredPayments.length && <tr><td colSpan={6}>No customer-school payment records found.</td></tr>}</tbody></table></div></section>
    </AdminShell>;
  }
  const [{ data: invoicesData }, { data: schools }] = await Promise.all([
    supabase.from("fee_invoices").select("id,invoice_number,total,paid_amount,remaining_amount,status,due_date,school_id,schools(name)").order("due_date", { ascending: true }).limit(100),
    supabase.from("schools").select("id,name").order("name", { ascending: true }),
  ]);
  const customerSchoolIds = (schools ?? []).map((school) => school.id);
  const rows = filterCustomerSchoolRows(invoicesData ?? [], customerSchoolIds);
  const total = rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const paid = rows.reduce((sum, row) => sum + Number(row.paid_amount ?? 0), 0);
  const due = rows.reduce((sum, row) => sum + Number(row.remaining_amount ?? 0), 0);
  return <AdminShell title="Billing" description="Only customer-school invoices are shown in the finance ledger. The master admin sees school subscriptions and invoice history, without internal platform records." breadcrumbs={[{ label: "Billing" }]}><section className="admin-kpi-grid"><article className="admin-kpi"><span>Total billed</span><strong>{formatCurrency(total)}</strong><small>Customer school invoices</small></article><article className="admin-kpi"><span>Total paid</span><strong>{formatCurrency(paid)}</strong><small>Collected against customer schools</small></article><article className="admin-kpi"><span>Total outstanding</span><strong>{formatCurrency(due)}</strong><small>Open customer receivables</small></article><article className="admin-kpi"><span>Invoices</span><strong>{rows.length}</strong><small>Active finance records</small></article></section><section className="admin-panel"><div className="admin-panel__heading"><div><p className="admin-kicker">Billing control</p><h2>Reconcile invoice status</h2></div></div><form action={reconcileBillingInvoices}><button type="submit" className="dashboard-action dashboard-action--primary">Reconcile all invoices</button></form></section><section className="admin-panel admin-panel--flush"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Invoice</th><th>School</th><th>Amount</th><th>Paid</th><th>Remaining</th><th>Due</th><th>Status</th></tr></thead><tbody>{rows.map((row) => { const nextState = reconcileInvoiceStatus({ total: Number(row.total ?? 0), paidAmount: Number(row.paid_amount ?? 0), dueDate: String(row.due_date ?? "") }); return <tr key={row.id}><td>{row.invoice_number}</td><td>{relation<{ name?: string }>(row.schools)?.name ?? "-"}</td><td>{formatCurrency(row.total)}</td><td>{formatCurrency(row.paid_amount)}</td><td>{formatCurrency(nextState.remainingAmount)}</td><td>{String(row.due_date)}</td><td><span className="admin-badge admin-badge--neutral">{nextState.status.replaceAll("_", " ")}</span></td></tr>; })}{!rows.length && <tr><td colSpan={7}>No customer-school invoice records found.</td></tr>}</tbody></table></div></section></AdminShell>;
}

async function StoragePage() {
  const { supabase } = await requireMasterAdmin();
  const [{ data: documents }, { data: schools }, { data: quotas }] = await Promise.all([
    supabase.from("school_documents").select("id,file_size,school_id"),
    supabase.from("schools").select("id,name"),
    supabase.from("school_storage_quotas").select("school_id,quota_bytes,warning_threshold,is_active"),
  ]);
  const rows = schools ?? [];
  const quotaMap = new Map((quotas ?? []).map((quota) => [String(quota.school_id), quota]));

  return <AdminShell title="Storage" description="Recorded document metadata grouped by school, with quotas and warning thresholds applied to each tenant's footprint." breadcrumbs={[{ label: "Storage" }]}><section className="admin-panel admin-panel--flush"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>School</th><th>Usage</th><th>Quota</th><th>Files</th><th>Status</th></tr></thead><tbody>{rows.map((school) => { const schoolDocs = (documents ?? []).filter((document) => document.school_id === school.id); const size = schoolDocs.reduce((sum, document) => sum + Number(document.file_size ?? 0), 0); const quota = quotaMap.get(String(school.id)); const quotaBytes = Number(quota?.quota_bytes ?? 0); const breakdown = getStorageQuotaStatus(size, quotaBytes || null); const ratioLabel = quotaBytes > 0 ? `${breakdown.percentage.toFixed(0)}% used` : "No quota"; const badgeClass = breakdown.status === "critical" ? "admin-badge--warning" : breakdown.status === "warning" ? "admin-badge--neutral" : "admin-badge--positive"; return <tr key={school.id}><td>{school.name}</td><td>{formatStorageBytes(size)}</td><td>{quotaBytes > 0 ? formatStorageBytes(quotaBytes) : "Unlimited"}</td><td>{schoolDocs.length}</td><td><span className={`admin-badge ${badgeClass}`}>{quotaBytes > 0 ? ratioLabel : "Unbounded"}</span></td></tr>; })}</tbody></table></div></section></AdminShell>;
}

async function UsagePage() {
  const { supabase } = await requireMasterAdmin();
  const [{ data: schools }, { data: roles }, { data: students }, { data: teachers }, { data: staff }, { data: attendance }, { data: assignments }, { data: documents }] = await Promise.all([supabase.from("schools").select("id"), supabase.from("user_roles").select("user_id"), supabase.from("students").select("id"), supabase.from("teachers").select("id"), supabase.from("staff").select("id"), supabase.from("student_attendance").select("id"), supabase.from("assignments").select("id"), supabase.from("school_documents").select("id")]);
  return <AdminShell title="Usage analytics" description="Current record volumes from the platform schema. No synthetic trends are generated." breadcrumbs={[{ label: "Usage analytics" }]}><section className="admin-kpi-grid">{[["Schools", schools?.length ?? 0], ["Accounts", new Set((roles ?? []).map((role) => role.user_id)).size], ["Students", students?.length ?? 0], ["Teachers", teachers?.length ?? 0], ["Staff", staff?.length ?? 0], ["Attendance records", attendance?.length ?? 0], ["Assignments", assignments?.length ?? 0], ["Documents", documents?.length ?? 0]].map(([label, value]) => <article className="admin-kpi" key={String(label)}><span>{String(label)}</span><strong>{String(value)}</strong><small>Current records</small></article>)}</section><AdminUnavailable title="Historical usage trends" detail="The current schema does not include time-series usage snapshots, login events, or platform quotas, so trend charts are not shown." /></AdminShell>;
}

async function ActivityPage() {
  const { supabase } = await requireMasterAdmin();
  const { data } = await supabase.from("audit_logs").select("id,action,entity_type,entity_id,metadata,created_at,actor_id,school_id,schools(name),profiles(full_name)").order("created_at", { ascending: false }).limit(100);
  return <AdminShell title="Activity & Audit" description="Append-only platform activity visible to the Master Admin." breadcrumbs={[{ label: "Activity / Audit" }]}><section className="admin-panel admin-panel--flush"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Time</th><th>School</th><th>Actor</th><th>Action</th><th>Target</th><th>Metadata</th></tr></thead><tbody>{(data ?? []).map((row) => <tr key={row.id}><td>{new Date(String(row.created_at)).toLocaleString()}</td><td>{relation<{ name?: string }>(row.schools)?.name ?? "-"}</td><td>{relation<{ full_name?: string }>(row.profiles)?.full_name ?? String(row.actor_id ?? "System")}</td><td><span className="admin-badge admin-badge--neutral">{row.action}</span></td><td>{row.entity_type} · {String(row.entity_id ?? "-").slice(0, 10)}</td><td><small>{JSON.stringify(row.metadata)}</small></td></tr>)}{!(data ?? []).length && <tr><td colSpan={6}>No audit events found.</td></tr>}</tbody></table></div></section></AdminShell>;
}

async function ContractsPage() {
  const { supabase } = await requireMasterAdmin();
  const { data } = await supabase.from("platform_contracts").select("id,contract_number,plan_name,pricing_model,monthly_amount,status,start_date,end_date,renewal_date,school_id,schools(name)").order("created_at", { ascending: false }).limit(100);
  return <AdminShell title="Contracts" description="Platform contracts for each school tenant, tracked as first-class data rather than UI-only placeholders." breadcrumbs={[{ label: "Contracts" }]}>
    <section className="admin-panel">
      <div className="admin-panel__heading">
        <div><p className="admin-kicker">Create contract</p><h2>Assign a plan to a school</h2></div>
      </div>
      <form action={createPlatformContract} className="student-form" style={{ marginTop: 12 }}>
        <div className="student-form-grid">
          <label className="student-field">School<select name="schoolId" required>{(await supabase.from("schools").select("id,name").order("name")).data?.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
          <label className="student-field">Contract number<input name="contractNumber" required /></label>
          <label className="student-field">Plan name<input name="planName" required /></label>
          <label className="student-field">Status<select name="status" defaultValue="draft"><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="expired">Expired</option><option value="cancelled">Cancelled</option></select></label>
          <label className="student-field">Billing model<select name="pricingModel" defaultValue="monthly"><option value="monthly">Monthly</option><option value="annual">Annual</option><option value="custom">Custom</option></select></label>
          <label className="student-field">Monthly amount<input type="number" name="monthlyAmount" min="0" step="0.01" defaultValue="0" /></label>
          <label className="student-field">Start date<input type="date" name="startDate" /></label>
          <label className="student-field">End date<input type="date" name="endDate" /></label>
          <label className="student-field">Renewal date<input type="date" name="renewalDate" /></label>
        </div>
        <button type="submit" className="dashboard-action dashboard-action--primary">Create Contract</button>
      </form>
    </section>
    <section className="admin-panel admin-panel--flush">
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Contract</th><th>School</th><th>Plan</th><th>Price</th><th>Status</th><th>Start</th><th>Renewal</th><th>Actions</th></tr></thead><tbody>{(data ?? []).map((row) => { const state = describeContractLifecycle(row.status, row.renewal_date); const renewalState = resolveContractRenewalWindow({ status: row.status, renewalDate: row.renewal_date, asOf: new Date().toISOString().slice(0, 10) }); return <tr key={row.id}><td>{row.contract_number}</td><td>{relation<{ name?: string }>(row.schools)?.name ?? "-"}</td><td>{row.plan_name}</td><td>{formatCurrency(row.monthly_amount)}</td><td><span className={`admin-badge ${state.isLive ? "admin-badge--positive" : "admin-badge--neutral"}`}>{state.label}{renewalState.isRenewalDue ? " · Due" : renewalState.warns ? " · Warning" : ""}</span></td><td>{String(row.start_date)}</td><td>{row.renewal_date ? String(row.renewal_date) : "—"}</td><td><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><form action={pauseSchoolContract}><input type="hidden" name="contractId" value={row.id} /><button type="submit" className="dashboard-action">Pause</button></form><form action={renewSchoolContract}><input type="hidden" name="contractId" value={row.id} /><input type="date" name="renewalDate" defaultValue={row.renewal_date ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)} /><button type="submit" className="dashboard-action dashboard-action--primary">Renew</button></form><form action={cancelSchoolContract}><input type="hidden" name="contractId" value={row.id} /><button type="submit" className="dashboard-action">Cancel</button></form></div></td></tr>; })}{!(data ?? []).length && <tr><td colSpan={8}>No contracts exist yet.</td></tr>}</tbody></table></div>
    </section>
  </AdminShell>;
}

async function TrialsPage() {
  const { supabase } = await requireMasterAdmin();
  const { data } = await supabase.from("school_trials").select("id,trial_name,school_id,status,starts_on,ends_on,seats,notes,schools(name)").order("starts_on", { ascending: false }).limit(100);

  return <AdminShell title="Trials" description="School trial windows and onboarding seats are tracked as live operational data." breadcrumbs={[{ label: "Trials" }]}>
    <section className="admin-panel">
      <div className="admin-panel__heading">
        <div><p className="admin-kicker">Start a trial</p><h2>Launch a pilot for a school</h2></div>
      </div>
      <form action={createSchoolTrial} className="student-form" style={{ marginTop: 12 }}>
        <div className="student-form-grid">
          <label className="student-field">School<select name="schoolId" required>{(await supabase.from("schools").select("id,name").order("name")).data?.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
          <label className="student-field">Trial name<input name="trialName" required /></label>
          <label className="student-field">Status<select name="status" defaultValue="pending"><option value="pending">Pending</option><option value="active">Active</option><option value="expired">Expired</option><option value="converted">Converted</option></select></label>
          <label className="student-field">Starts on<input type="date" name="startsOn" /></label>
          <label className="student-field">Ends on<input type="date" name="endsOn" required /></label>
          <label className="student-field">Seats<input type="number" name="seats" min="1" defaultValue="25" /></label>
          <label className="student-field student-field-wide">Notes<textarea name="notes" rows={3} /></label>
        </div>
        <button type="submit" className="dashboard-action dashboard-action--primary">Create Trial</button>
      </form>
    </section>
    <section className="admin-panel admin-panel--flush">
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Trial</th><th>School</th><th>Status</th><th>Starts</th><th>Ends</th><th>Seats</th></tr></thead><tbody>{(data ?? []).map((row) => <tr key={row.id}><td>{row.trial_name}</td><td>{relation<{ name?: string }>(row.schools)?.name ?? "-"}</td><td><span className="admin-badge admin-badge--neutral">{row.status}</span></td><td>{String(row.starts_on)}</td><td>{String(row.ends_on)}</td><td>{row.seats}</td></tr>)}{!(data ?? []).length && <tr><td colSpan={6}>No trial records exist yet.</td></tr>}</tbody></table></div>
    </section>
  </AdminShell>;
}

async function NotificationsPage() {
  const { supabase } = await requireMasterAdmin();
  const { data } = await supabase.from("notifications").select("id,title,message,event_type,created_at,read_at,school_id,schools(name)").order("created_at", { ascending: false }).limit(100);

  return <AdminShell title="Notifications" description="Platform and school notification records tracked in the system. Master Admin can see the operational feed without bypassing school scoping." breadcrumbs={[{ label: "Notifications" }]}><section className="admin-panel admin-panel--flush"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>School</th><th>Event</th><th>Title</th><th>Message</th><th>Created</th><th>Read</th></tr></thead><tbody>{(data ?? []).map((row) => <tr key={row.id}><td>{relation<{ name?: string }>(row.schools)?.name ?? "-"}</td><td>{row.event_type}</td><td>{row.title}</td><td>{row.message}</td><td>{new Date(String(row.created_at)).toLocaleString()}</td><td>{row.read_at ? new Date(String(row.read_at)).toLocaleString() : "Unread"}</td></tr>)}{!(data ?? []).length && <tr><td colSpan={6}>No notifications exist yet.</td></tr>}</tbody></table></div></section></AdminShell>;
}

async function SettingsPage() {
  const { supabase } = await requireMasterAdmin();
  const { data } = await supabase.from("school_settings").select("school_id,schools(name),timezone,currency_code,date_format,locale,updated_at").order("updated_at", { ascending: false }).limit(100);
  return <AdminShell title="Admin settings" description="Global school configuration data is visible to the master admin and remains tenant-scoped." breadcrumbs={[{ label: "Admin settings" }]}><section className="admin-panel admin-panel--flush"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>School</th><th>Timezone</th><th>Currency</th><th>Date format</th><th>Locale</th><th>Updated</th></tr></thead><tbody>{(data ?? []).map((row) => <tr key={row.school_id}><td>{relation<{ name?: string }>(row.schools)?.name ?? "-"}</td><td>{row.timezone}</td><td>{row.currency_code}</td><td>{row.date_format}</td><td>{row.locale}</td><td>{new Date(String(row.updated_at)).toLocaleString()}</td></tr>)}{!(data ?? []).length && <tr><td colSpan={6}>No school settings are available yet.</td></tr>}</tbody></table></div></section></AdminShell>;
}

async function ReportsPage() {
  const { supabase } = await requireMasterAdmin();
  const [{ data: schools }, { data: invoices }, { data: payments }, { data: roles }, { data: students }, { data: teachers }] = await Promise.all([supabase.from("schools").select("id,is_active"), supabase.from("fee_invoices").select("total,paid_amount,remaining_amount"), supabase.from("fee_payments").select("amount"), supabase.from("user_roles").select("user_id"), supabase.from("students").select("id"), supabase.from("teachers").select("id")]);
  return <AdminShell title="Reports" description="Global reports assembled from current operational tables." breadcrumbs={[{ label: "Reports" }]}><section className="admin-panel"><div className="admin-panel__heading"><div><p className="admin-kicker">Available reports</p><h2>Platform snapshot</h2></div><a className="admin-button admin-button--primary" href="/reports/export">Export CSV</a></div><div className="admin-report-list"><div><span>Schools report</span><strong>{schools?.length ?? 0} schools · {schools?.filter((school) => school.is_active).length ?? 0} active</strong></div><div><span>Accounts report</span><strong>{new Set((roles ?? []).map((role) => role.user_id)).size} accounts</strong></div><div><span>Billing report</span><strong>{formatCurrency((invoices ?? []).reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0))} billed</strong></div><div><span>Payments report</span><strong>{formatCurrency((payments ?? []).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0))} received</strong></div><div><span>People report</span><strong>{students?.length ?? 0} students · {teachers?.length ?? 0} teachers</strong></div></div></section></AdminShell>;
}

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === "accounts") return <AccountsPage />;
  if (section === "billing") return <BillingPage />;
  if (section === "payments") return <BillingPage payments />;
  if (section === "storage") return <StoragePage />;
  if (section === "usage") return <UsagePage />;
  if (section === "activity") return <ActivityPage />;
  if (section === "contracts") return <ContractsPage />;
  if (section === "trials") return <TrialsPage />;
  if (section === "notifications") return <NotificationsPage />;
  if (section === "settings") return <SettingsPage />;
  if (section === "reports") return <ReportsPage />;
  return <AdminShell title="Not found" description="The requested admin section does not exist." breadcrumbs={[{ label: "Not found" }]}><AdminUnavailable title="Admin section not found" detail="Choose a section from the Master Admin navigation." /></AdminShell>;
}
