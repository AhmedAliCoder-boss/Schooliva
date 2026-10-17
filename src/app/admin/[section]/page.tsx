import { AdminShell, AdminUnavailable, AdminWorkflowNotice } from "@/components/admin/admin-shell";
import { AdminContractsWorkspace } from "@/components/admin/admin-contracts-workspace";
import { PlatformFinanceWorkspace, PlatformPaymentsWorkspace } from "@/components/admin/admin-finance-workspace";
import { PlatformNotificationWorkspace } from "@/components/admin/platform-notification-workspace";
import { AdminTrialsWorkspace } from "@/components/admin/admin-trials-workspace";
import { filterCustomerSchoolRows } from "@/lib/admin/customer-schools";
import { requireMasterAdmin } from "@/lib/admin/guard";
import { formatCurrency } from "@/lib/format/currency";
import { reconcileInvoiceStatus } from "@/lib/billing-reconciliation";
import { formatStorageBytes, getStorageQuotaStatus } from "@/lib/storage/quota";
import { redirect } from "next/navigation";

function relation<T>(value: unknown): T | null { return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null; }

function notificationErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") return { code: "", message: String(error ?? "") };
  const value = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  return {
    code: typeof value.code === "string" ? value.code : "",
    message: typeof value.message === "string" ? value.message : "",
    details: typeof value.details === "string" ? value.details : "",
    hint: typeof value.hint === "string" ? value.hint : "",
  };
}

function isNotificationCampaignSchemaMissing(error: unknown) {
  const details = notificationErrorDetails(error);
  const text = `${details.message} ${details.details} ${details.hint}`.toLowerCase();
  const missingObject = [
    "platform_notification_campaigns",
    "get_platform_notification_audience",
    "get_platform_notification_campaign_metrics",
  ].some((objectName) => text.includes(objectName));
  return missingObject && ["PGRST205", "PGRST202", "42P01", "42883"].includes(details.code);
}

function NotificationMigrationPending() {
  return <AdminShell title="Notifications" description="The cross-school campaign workspace needs its database objects before it can load." breadcrumbs={[{ label: "Notifications" }]}>
    <AdminUnavailable
      title="Notification campaign migration is not applied"
      detail="Apply supabase/migrations/20261017000100_master_admin_notification_campaigns.sql to the Supabase project used by this app, then reload this page. If it was already applied, confirm the app is connected to that same project and refresh the PostgREST schema cache."
    />
  </AdminShell>;
}

async function BillingPage({ payments = false, searchParams }: { payments?: boolean; searchParams: Promise<{ success?: string; error?: string }> }) {
  const params = await searchParams;
  const { supabase } = await requireMasterAdmin();
  if (payments) {
    const [{ data: paymentsData, error: paymentsError }, { data: billsData, error: billsError }, { data: schools, error: schoolsError }] = await Promise.all([
    supabase.from("platform_transactions").select("id,transaction_reference,amount,payment_method,transaction_date,school_id,bill_id").order("transaction_date", { ascending: false }).limit(100),
      supabase.from("platform_bills").select("id,bill_number,description,total_amount,paid_amount,due_date,school_id").order("due_date", { ascending: true }).order("id", { ascending: true }).range(0, 499),
      supabase.from("schools").select("id,name").order("name", { ascending: true }),
    ]);
    if (paymentsError || billsError || schoolsError) throw new Error("Unable to load Master Admin payment records.");
    const billRows = [...(billsData ?? [])];
    let nextOffset = 500;
    let hasMore = (billsData?.length ?? 0) === 500;
    while (hasMore) {
      const { data, error } = await supabase.from("platform_bills")
        .select("id,bill_number,description,total_amount,paid_amount,due_date,school_id")
        .order("due_date", { ascending: true })
        .order("id", { ascending: true })
        .range(nextOffset, nextOffset + 499);
      if (error) throw new Error("Unable to load all school bills for payment entry.");
      billRows.push(...(data ?? []));
      hasMore = (data?.length ?? 0) === 500;
      nextOffset += 500;
    }
    const customerSchoolIds = (schools ?? []).map((school) => school.id);
    const filteredPayments = customerSchoolIds.length ? filterCustomerSchoolRows(paymentsData ?? [], customerSchoolIds) : [];
    const schoolNames = new Map((schools ?? []).map((school) => [school.id, school.name]));
    const billNumbers = new Map(billRows.map((bill) => [bill.id, bill.bill_number]));
    const filteredOutstandingBills = (customerSchoolIds.length ? filterCustomerSchoolRows(billRows, customerSchoolIds) : [])
      .filter((bill) => Number(bill.total_amount) > Number(bill.paid_amount ?? 0));
    const schoolOptions = (schools ?? []).map((school) => ({ id: school.id, name: school.name }));
    const paymentRows = filteredPayments.map((payment) => ({
      id: payment.id,
      billId: payment.bill_id,
      reference: payment.transaction_reference,
      amount: Number(payment.amount ?? 0),
      method: String(payment.payment_method ?? "other"),
      date: String(payment.transaction_date ?? ""),
      schoolId: String(payment.school_id ?? ""),
      schoolName: schoolNames.get(payment.school_id) ?? "-",
      billNumber: billNumbers.get(payment.bill_id) ?? "-",
    }));
    const outstandingBills = filteredOutstandingBills.map((bill) => ({
      id: bill.id,
      billNumber: bill.bill_number,
      schoolId: bill.school_id,
      schoolName: schools?.find((school) => school.id === bill.school_id)?.name ?? "School",
      description: bill.description,
      totalAmount: Number(bill.total_amount ?? 0),
      paidAmount: Number(bill.paid_amount ?? 0),
      balance: Math.max(Number(bill.total_amount ?? 0) - Number(bill.paid_amount ?? 0), 0),
      dueDate: String(bill.due_date ?? ""),
      status: reconcileInvoiceStatus({
        total: Number(bill.total_amount ?? 0),
        paidAmount: Number(bill.paid_amount ?? 0),
        dueDate: String(bill.due_date ?? ""),
      }).status,
    }));

    return <AdminShell title="Payments" description="Platform transactions recorded against school bills." breadcrumbs={[{ label: "Payments" }]}>
      <AdminWorkflowNotice code={params.success} success />
      <AdminWorkflowNotice code={params.error} />
      <PlatformPaymentsWorkspace payments={paymentRows} schools={schoolOptions} outstandingBills={outstandingBills} asOfDate={new Date().toISOString().slice(0, 10)} />
    </AdminShell>;
  }
  const [{ data: firstPage, error: firstPageError }, { data: schools, error: schoolsError }] = await Promise.all([
    supabase.from("platform_bills").select("id,bill_number,description,total_amount,paid_amount,status,due_date,school_id,schools(name)").order("due_date", { ascending: true }).order("id", { ascending: true }).range(0, 499),
    supabase.from("schools").select("id,name").order("name", { ascending: true }),
  ]);
  if (firstPageError || schoolsError) throw new Error("Unable to load Master Admin billing records.");
  const billRows = [...(firstPage ?? [])];
  let nextOffset = 500;
  let hasMore = (firstPage?.length ?? 0) === 500;
  while (hasMore) {
    const { data, error } = await supabase.from("platform_bills")
      .select("id,bill_number,description,total_amount,paid_amount,status,due_date,school_id,schools(name)")
      .order("due_date", { ascending: true })
      .order("id", { ascending: true })
      .range(nextOffset, nextOffset + 499);
    if (error) throw new Error("Unable to load all Master Admin billing records.");
    billRows.push(...(data ?? []));
    hasMore = (data?.length ?? 0) === 500;
    nextOffset += 500;
  }
  const customerSchoolIds = (schools ?? []).map((school) => school.id);
  const rows = customerSchoolIds.length ? filterCustomerSchoolRows(billRows, customerSchoolIds) : [];
  const schoolOptions = (schools ?? []).map((school) => ({ id: school.id, name: school.name }));
  const financeBills = rows.map((row) => {
    const amount = Number(row.total_amount ?? 0);
    const paidAmount = Number(row.paid_amount ?? 0);
    const balance = reconcileInvoiceStatus({ total: amount, paidAmount, dueDate: String(row.due_date ?? "") });
    return {
      id: row.id,
      billNumber: row.bill_number,
      schoolId: row.school_id,
      schoolName: relation<{ name?: string }>(row.schools)?.name ?? "-",
      description: row.description,
      totalAmount: amount,
      paidAmount,
      remainingAmount: balance.remainingAmount,
      dueDate: String(row.due_date ?? ""),
      status: balance.status,
    };
  });
  return <AdminShell title="Billing" description="School bills and platform charges managed by Master Admin." breadcrumbs={[{ label: "Billing" }]}>
    <AdminWorkflowNotice code={params.success} success />
    <AdminWorkflowNotice code={params.error} />
    <PlatformFinanceWorkspace bills={financeBills} schools={schoolOptions} asOfDate={new Date().toISOString().slice(0, 10)} />
  </AdminShell>;
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
  const [{ data: schools }, { data: roles }, { data: students }, { data: teachers }, { data: staff }, { data: attendance }, { data: assignments }, { data: documents }, { data: snapshots }, { data: quotas }, { data: loginEvents }] = await Promise.all([
    supabase.from("schools").select("id"),
    supabase.from("user_roles").select("user_id"),
    supabase.from("students").select("id"),
    supabase.from("teachers").select("id"),
    supabase.from("staff").select("id"),
    supabase.from("student_attendance").select("id"),
    supabase.from("assignments").select("id"),
    supabase.from("school_documents").select("id"),
    supabase.from("platform_usage_snapshots").select("snapshot_date,total_accounts,active_users,login_count,attendance_records,assignment_records,document_records").order("snapshot_date", { ascending: true }).limit(30),
    supabase.from("platform_quotas").select("quota_key,quota_label,quota_limit,used_value,warning_threshold,is_active").order("quota_key", { ascending: true }),
    supabase.from("platform_login_events").select("occurred_at,status").order("occurred_at", { ascending: false }).limit(30),
  ]);
  const history = (snapshots ?? []).slice(-7);
  const recentLogins = (loginEvents ?? []).slice(0, 7);
  const hasHistoricalData = history.length > 0 || (quotas ?? []).length > 0 || recentLogins.length > 0;
  const maxActiveUsers = Math.max(1, ...history.map((row) => Number(row.active_users ?? 0)));
  const maxLoginCount = Math.max(1, ...history.map((row) => Number(row.login_count ?? 0)));

  return <AdminShell title="Usage analytics" description="Current platform volume and recent historical trends discovered from the operational schema." breadcrumbs={[{ label: "Usage analytics" }]}><section className="admin-kpi-grid">{[["Schools", schools?.length ?? 0], ["Accounts", new Set((roles ?? []).map((role) => role.user_id)).size], ["Students", students?.length ?? 0], ["Teachers", teachers?.length ?? 0], ["Staff", staff?.length ?? 0], ["Attendance records", attendance?.length ?? 0], ["Assignments", assignments?.length ?? 0], ["Documents", documents?.length ?? 0]].map(([label, value]) => <article className="admin-kpi" key={String(label)}><span>{String(label)}</span><strong>{String(value)}</strong><small>Current records</small></article>)}</section>{hasHistoricalData ? <section className="admin-panel"><div className="admin-panel__heading"><div><p className="admin-kicker">Historical usage trends</p><h2>Platform activity over time</h2></div></div><div style={{ display: "grid", gap: 18 }}><div><h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Active users</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(52px, 1fr))", gap: 8, alignItems: "end", minHeight: 140 }}>
        {history.map((row) => {
          const value = Number(row.active_users ?? 0);
          return <div key={String(row.snapshot_date)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}><div style={{ width: "100%", height: 100, display: "flex", alignItems: "end", justifyContent: "center", background: "linear-gradient(180deg, rgba(59,130,246,.12), rgba(59,130,246,.02))", borderRadius: 8, padding: 4 }}><span style={{ display: "block", width: "100%", height: `${Math.max(16, (value / maxActiveUsers) * 100)}%`, background: "linear-gradient(180deg, #3b82f6, #1d4ed8)", borderRadius: 6 }} /></div><strong style={{ fontSize: 11 }}>{String(value)}</strong><small style={{ fontSize: 10, color: "#64748b" }}>{String(row.snapshot_date).slice(5)}</small></div>;
        })}</div></div><div><h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Login activity</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(52px, 1fr))", gap: 8, alignItems: "end", minHeight: 140 }}>
        {history.map((row) => {
          const value = Number(row.login_count ?? 0);
          return <div key={`${String(row.snapshot_date)}-login`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}><div style={{ width: "100%", height: 100, display: "flex", alignItems: "end", justifyContent: "center", background: "linear-gradient(180deg, rgba(16,185,129,.12), rgba(16,185,129,.02))", borderRadius: 8, padding: 4 }}><span style={{ display: "block", width: "100%", height: `${Math.max(16, (value / maxLoginCount) * 100)}%`, background: "linear-gradient(180deg, #10b981, #047857)", borderRadius: 6 }} /></div><strong style={{ fontSize: 11 }}>{String(value)}</strong><small style={{ fontSize: 10, color: "#64748b" }}>{String(row.snapshot_date).slice(5)}</small></div>;
        })}</div></div>{(quotas ?? []).length > 0 ? <div><h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Platform quotas</h3><div style={{ display: "grid", gap: 12 }}>{(quotas ?? []).map((quota) => { const limit = Number(quota.quota_limit ?? 0); const used = Number(quota.used_value ?? 0); const ratio = limit > 0 ? Math.min((used / limit) * 100, 100) : 0; return <div key={String(quota.quota_key)} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}><strong>{String(quota.quota_label ?? quota.quota_key)}</strong><span>{limit > 0 ? `${Math.round(ratio)}% used` : "No limit"}</span></div><div style={{ background: "#e2e8f0", borderRadius: 999, height: 8, overflow: "hidden" }}><span style={{ display: "block", width: `${Math.max(6, ratio)}%`, height: "100%", background: ratio >= 80 ? "#f59e0b" : "#2563eb", borderRadius: 999 }} /></div><small style={{ color: "#64748b", display: "block", marginTop: 8 }}>{used.toLocaleString()} / {limit > 0 ? limit.toLocaleString() : "∞"}</small></div>; })}</div></div> : null}{recentLogins.length > 0 ? <div><h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Recent login events</h3><ul style={{ margin: 0, paddingLeft: 18, color: "#334155" }}>{recentLogins.map((event) => <li key={String(event.occurred_at)}>{new Date(String(event.occurred_at)).toLocaleString()} · {String(event.status)}</li>)}</ul></div> : null}</div></section> : <AdminUnavailable title="Historical usage trends" detail="The current schema has not yet captured platform usage snapshots or quotas. After the migration is applied, trend charts will be shown here." />}</AdminShell>;
}

async function ActivityPage() {
  const { supabase } = await requireMasterAdmin();
  const { data } = await supabase.from("audit_logs").select("id,action,entity_type,entity_id,metadata,created_at,actor_id,school_id,schools(name),profiles(full_name)").order("created_at", { ascending: false }).limit(100);
  return <AdminShell title="Activity & Audit" description="Append-only platform activity visible to the Master Admin." breadcrumbs={[{ label: "Activity / Audit" }]}><section className="admin-panel admin-panel--flush"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Time</th><th>School</th><th>Actor</th><th>Action</th><th>Target</th><th>Metadata</th></tr></thead><tbody>{(data ?? []).map((row) => <tr key={row.id}><td>{new Date(String(row.created_at)).toLocaleString()}</td><td>{relation<{ name?: string }>(row.schools)?.name ?? "-"}</td><td>{relation<{ full_name?: string }>(row.profiles)?.full_name ?? String(row.actor_id ?? "System")}</td><td><span className="admin-badge admin-badge--neutral">{row.action}</span></td><td>{row.entity_type} · {String(row.entity_id ?? "-").slice(0, 10)}</td><td><small>{JSON.stringify(row.metadata)}</small></td></tr>)}{!(data ?? []).length && <tr><td colSpan={6}>No audit events found.</td></tr>}</tbody></table></div></section></AdminShell>;
}

async function ContractsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const params = await searchParams;
  const { supabase } = await requireMasterAdmin();
  const [{ data, error }, { data: schoolRows, error: schoolsError }] = await Promise.all([
    supabase.from("platform_contracts").select("id,contract_number,plan_name,pricing_model,monthly_amount,status,start_date,end_date,subscription_valid_until,renewal_date,school_id,schools(name)").order("created_at", { ascending: false }).limit(500),
    supabase.from("schools").select("id,name").order("name"),
  ]);
  if (error || schoolsError) {
    console.error("Master Admin contract portfolio could not be loaded.", { error, schoolsError });
    throw new Error("Master Admin contract portfolio could not be loaded.");
  }
  const contracts = (data ?? []).map((row) => ({
    id: row.id,
    contractNumber: row.contract_number,
    planName: row.plan_name,
    pricingModel: row.pricing_model,
    monthlyAmount: Number(row.monthly_amount ?? 0),
    status: row.status,
    startDate: String(row.start_date),
    endDate: row.end_date ? String(row.end_date) : null,
    subscriptionValidUntil: row.subscription_valid_until ? String(row.subscription_valid_until) : null,
    renewalDate: row.renewal_date ? String(row.renewal_date) : null,
    schoolId: row.school_id,
    schoolName: relation<{ name?: string }>(row.schools)?.name ?? "School",
  }));
  return <AdminShell title="Contracts" description="Manage plans, renewals, revenue exposure, and agreements across Schooliva tenants. Schedule each renewal invoice when it is ready; payment no longer creates an extra bill automatically." breadcrumbs={[{ label: "Contracts" }]}>
    <AdminWorkflowNotice code={params.success} success />
    <AdminWorkflowNotice code={params.error} />
    <AdminContractsWorkspace
      contracts={contracts}
      schools={(schoolRows ?? []).map((school) => ({ id: school.id, name: school.name }))}
      asOfDate={new Date().toISOString().slice(0, 10)}
    />
  </AdminShell>;
}

async function TrialsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const params = await searchParams;
  const { supabase } = await requireMasterAdmin();
  const [{ data, error }, { data: schoolRows, error: schoolsError }] = await Promise.all([
    supabase.from("school_trials").select("id,trial_name,school_id,status,starts_on,ends_on,seats,notes,schools(name)").order("starts_on", { ascending: false }).limit(500),
    supabase.from("schools").select("id,name").order("name"),
  ]);
  if (error || schoolsError) {
    console.error("Master Admin trial pipeline could not be loaded.", { error, schoolsError });
    throw new Error("Master Admin trial pipeline could not be loaded.");
  }
  const trials = (data ?? []).map((row) => ({
    id: row.id,
    trialName: row.trial_name,
    schoolId: row.school_id,
    schoolName: relation<{ name?: string }>(row.schools)?.name ?? "School",
    status: row.status,
    startsOn: String(row.starts_on),
    endsOn: String(row.ends_on),
    seats: Number(row.seats),
    notes: row.notes,
  }));
  return <AdminShell title="Trials" description="Manage onboarding pilots, monitor conversion readiness, and keep every school trial on track." breadcrumbs={[{ label: "Trials" }]}>
    <AdminWorkflowNotice code={params.success} success />
    <AdminWorkflowNotice code={params.error} />
    <AdminTrialsWorkspace
      trials={trials}
      schools={(schoolRows ?? []).map((school) => ({ id: school.id, name: school.name }))}
      asOfDate={new Date().toISOString().slice(0, 10)}
    />
  </AdminShell>;
}

async function NotificationsPage() {
  const { supabase } = await requireMasterAdmin();
  const [{ data: schoolRows, error: schoolsError }, { data: campaignRows, error: campaignsError }] = await Promise.all([
    supabase.from("schools").select("id,name,is_active").order("name", { ascending: true }),
    supabase.from("platform_notification_campaigns")
      .select("id,title,message,role_slugs,school_ids,recipient_count,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (schoolsError || campaignsError) {
    console.error("Master Admin notification workspace could not be loaded.", {
      schools: notificationErrorDetails(schoolsError),
      campaigns: notificationErrorDetails(campaignsError),
    });
    if (campaignsError && isNotificationCampaignSchemaMissing(campaignsError)) return <NotificationMigrationPending />;
    throw new Error("Master Admin notification workspace could not be loaded.");
  }

  const schools = (schoolRows ?? []).map((school) => ({
    id: school.id,
    name: school.name,
    isActive: school.is_active,
  }));
  const activeSchoolIds = schools.filter((school) => school.isActive).map((school) => school.id);
  const { data: audienceRows, error: audienceError } = activeSchoolIds.length
    ? await supabase.rpc("get_platform_notification_audience", { target_school_ids: activeSchoolIds })
    : { data: [], error: null };
  if (audienceError) {
    console.error("Master Admin notification audiences could not be loaded.", notificationErrorDetails(audienceError));
    if (isNotificationCampaignSchemaMissing(audienceError)) return <NotificationMigrationPending />;
    throw new Error("Master Admin notification audiences could not be loaded.");
  }

  const campaignIds = (campaignRows ?? []).map((campaign) => campaign.id);
  const { data: metricRows, error: metricsError } = campaignIds.length
    ? await supabase.rpc("get_platform_notification_campaign_metrics", { target_campaign_ids: campaignIds })
    : { data: [], error: null };
  if (metricsError) {
    console.error("Master Admin campaign readership could not be loaded.", notificationErrorDetails(metricsError));
    if (isNotificationCampaignSchemaMissing(metricsError)) return <NotificationMigrationPending />;
    throw new Error("Master Admin campaign readership could not be loaded.");
  }

  const metrics = (metricRows ?? []) as Array<{ campaign_id: string; read_count: number | null }>;
  const audience = (audienceRows ?? []) as Array<{ school_id: string; role_slug: string; role_name: string; recipient_count: number | null }>;
  const metricsByCampaign = new Map(metrics.map((metric) => [
    metric.campaign_id,
    Number(metric.read_count ?? 0),
  ]));
  const campaigns = (campaignRows ?? []).map((campaign) => ({
    id: campaign.id,
    title: campaign.title,
    message: campaign.message,
    roleSlugs: campaign.role_slugs,
    schoolIds: campaign.school_ids,
    recipientCount: campaign.recipient_count,
    createdAt: campaign.created_at,
    readCount: metricsByCampaign.get(campaign.id) ?? 0,
  }));
  const audienceRoles = audience.map((row) => ({
    schoolId: row.school_id,
    slug: row.role_slug,
    name: row.role_name,
    recipientCount: Number(row.recipient_count ?? 0),
  }));

  return <AdminShell title="Notifications" description="Target, send, and monitor announcements across every Schooliva customer school." breadcrumbs={[{ label: "Notifications" }]}>
    <PlatformNotificationWorkspace schools={schools} audienceRoles={audienceRoles} campaigns={campaigns} />
  </AdminShell>;
}

async function SettingsPage() {
  const { supabase } = await requireMasterAdmin();
  const { data } = await supabase.from("school_settings").select("school_id,schools(name),timezone,currency_code,date_format,locale,updated_at").order("updated_at", { ascending: false }).limit(100);
  return <AdminShell title="Admin settings" description="Global school configuration data is visible to the master admin and remains tenant-scoped." breadcrumbs={[{ label: "Admin settings" }]}><section className="admin-panel admin-panel--flush"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>School</th><th>Timezone</th><th>Currency</th><th>Date format</th><th>Locale</th><th>Updated</th></tr></thead><tbody>{(data ?? []).map((row) => <tr key={row.school_id}><td>{relation<{ name?: string }>(row.schools)?.name ?? "-"}</td><td>{row.timezone}</td><td>{row.currency_code}</td><td>{row.date_format}</td><td>{row.locale}</td><td>{new Date(String(row.updated_at)).toLocaleString()}</td></tr>)}{!(data ?? []).length && <tr><td colSpan={6}>No school settings are available yet.</td></tr>}</tbody></table></div></section></AdminShell>;
}

async function ReportsPage() {
  const { supabase } = await requireMasterAdmin();
  const [{ data: schools }, { data: invoices }, { data: payments }, { data: roles }, { data: students }, { data: teachers }] = await Promise.all([supabase.from("schools").select("id,is_active"), supabase.from("platform_bills").select("total:total_amount"), supabase.from("platform_transactions").select("amount"), supabase.from("user_roles").select("user_id"), supabase.from("students").select("id"), supabase.from("teachers").select("id")]);
  return <AdminShell title="Reports" description="Global reports assembled from current operational tables." breadcrumbs={[{ label: "Reports" }]}><section className="admin-panel"><div className="admin-panel__heading"><div><p className="admin-kicker">Available reports</p><h2>Platform snapshot</h2></div><a className="admin-button admin-button--primary" href="/reports/export">Export CSV</a></div><div className="admin-report-list"><div><span>Schools report</span><strong>{schools?.length ?? 0} schools · {schools?.filter((school) => school.is_active).length ?? 0} active</strong></div><div><span>Accounts report</span><strong>{new Set((roles ?? []).map((role) => role.user_id)).size} accounts</strong></div><div><span>Billing report</span><strong>{formatCurrency((invoices ?? []).reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0))} billed</strong></div><div><span>Payments report</span><strong>{formatCurrency((payments ?? []).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0))} received</strong></div><div><span>People report</span><strong>{students?.length ?? 0} students · {teachers?.length ?? 0} teachers</strong></div></div></section></AdminShell>;
}

export default async function AdminSectionPage({ params, searchParams }: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { section } = await params;
  if (section === "accounts") redirect("/admin/accounts");
  if (section === "billing") return <BillingPage searchParams={searchParams} />;
  if (section === "payments") return <BillingPage payments searchParams={searchParams} />;
  if (section === "storage") return <StoragePage />;
  if (section === "usage") return <UsagePage />;
  if (section === "activity") return <ActivityPage />;
  if (section === "contracts") return <ContractsPage searchParams={searchParams} />;
  if (section === "trials") return <TrialsPage searchParams={searchParams} />;
  if (section === "notifications") return <NotificationsPage />;
  if (section === "settings") return <SettingsPage />;
  if (section === "reports") return <ReportsPage />;
  return <AdminShell title="Not found" description="The requested admin section does not exist." breadcrumbs={[{ label: "Not found" }]}><AdminUnavailable title="Admin section not found" detail="Choose a section from the Master Admin navigation." /></AdminShell>;
}
