import { cancelSchoolContract, createPlatformBill, createPlatformContract, createSchoolTrial, pauseSchoolContract, recordPlatformTransaction, reconcilePlatformBills, renewSchoolContract } from "@/app/actions/admin";
import { setSchoolUserPassword, updateSchoolUserProfile } from "@/app/actions/user-management";
import { AccountEditPanel } from "@/components/admin/account-edit-panel";
import { AdminShell, AdminUnavailable } from "@/components/admin/admin-shell";
import { filterCustomerSchoolRows } from "@/lib/admin/customer-schools";
import { requireMasterAdmin } from "@/lib/admin/guard";
import { formatCurrency } from "@/lib/format/currency";
import { describeContractLifecycle } from "@/lib/billing-lifecycle";
import { reconcileInvoiceStatus } from "@/lib/billing-reconciliation";
import { resolveContractRenewalWindow } from "@/lib/contract-renewal";
import { formatStorageBytes, getStorageQuotaStatus } from "@/lib/storage/quota";

function relation<T>(value: unknown): T | null { return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null; }

async function AccountsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; warning?: string }> }) {
  const { supabase } = await requireMasterAdmin();
  const [{ data: memberships, error: membershipsError }, { data: profiles, error: profilesError }, { data: roles, error: rolesError }] = await Promise.all([
    supabase.from("user_roles").select("user_id,school_id,role_id,created_at,roles(name,slug),schools(name)").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id,full_name,username,phone,email,is_active,created_at"),
    supabase.from("roles").select("id,school_id,name,slug").order("name"),
  ]);
  if (membershipsError || profilesError || rolesError) {
    return <AdminShell title="Accounts" description="Account management is temporarily unavailable. Please try again." breadcrumbs={[{ label: "Accounts" }]}><p className="auth-error">Accounts could not be loaded. Please refresh and try again.</p></AdminShell>;
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [String(profile.id), profile]));
  const protectedUserIds = new Set((memberships ?? []).filter((membership) => {
    const role = relation<{ slug?: string }>(membership.roles);
    return role?.slug === "super_admin" || role?.slug === "master_admin";
  }).map((membership) => String(membership.user_id)));
  const status = await searchParams;
  const successMessage = status.success === "profile-updated"
    ? "Account profile and school role were updated."
    : status.success === "password-updated"
      ? "Account password changed."
      : null;
  const errorMessage = status.error === "admin-auth-not-configured"
    ? "Direct password changes are not enabled yet. Set the server-only SUPABASE_SERVICE_ROLE_KEY in the app hosting environment."
    : status.error === "invalid-username"
      ? "Username save nahi hua: 3–30 characters use karein; sirf English letters, numbers, dot (.), dash (-), ya underscore (_) allowed hain. Spaces nahi."
      : status.error === "invalid-full-name"
        ? "Full name kam se kam 2 characters ka hona chahiye aur 120 characters se zyada nahi ho sakta."
        : status.error === "invalid-role"
          ? "Selected school role valid nahi hai. Account dobara khol kar role select karein."
          : status.error === "invalid-phone"
            ? "Phone number 40 characters se zyada nahi ho sakta."
            : status.error === "invalid-school-reference"
              ? "School account link invalid hai. Accounts list refresh karein; agar phir bhi issue ho to is account ko School Details > Accounts se edit karein."
              : status.error === "invalid-user-reference"
                ? "Account reference invalid hai. Accounts page refresh karke account dobara kholen."
                : status.error === "school-selection-required"
                  ? "Yeh account multiple schools se linked hai. Is account ko us specific school ke School Details > Accounts page se edit karein."
                  : status.error === "school-lookup-failed"
                    ? "Account ka school lookup nahi ho saka. Page refresh karke dobara try karein."
        : status.error === "invalid-account-details" || status.error === "invalid-profile"
          ? "MBSadmin valid username hai. Username issue nahi hai; edit drawer band karke account dobara kholen aur full name aur school role check karke save karein."
    : status.error === "password-update-failed"
      ? "Password change failed. Check that the new password meets your Supabase Auth password policy."
      : status.error === "invalid-password"
        ? "Password must be at least 8 characters, match its confirmation, and belong to another account."
        : status.error;

  return <AdminShell title="Accounts" description="Edit a user's profile, login ID, or school role, or set a new password directly. Platform administrator identities stay protected." breadcrumbs={[{ label: "Accounts" }]}>
    <div className="admin-account-messages" aria-live="polite">
      {errorMessage && <p className="auth-error">{errorMessage}</p>}
      {status.warning === "audit-failed" && <p className="auth-error">The account change completed, but its audit event could not be recorded. Please contact support.</p>}
      {status.warning === "password-audit-failed" && <p className="auth-error">Password changed, but the audit event could not be recorded. Please contact support.</p>}
      {status.warning === "login-username-sync-failed" && <p className="auth-error">The database profile changed, but login metadata could not be synchronized. Re-save the account or check the server-only Supabase key.</p>}
      {status.error === "profile-update-not-verified" && <p className="auth-error">The account update could not be verified in the database. No success was reported; refresh and try again.</p>}
      {status.error === "account-auth-unavailable" && <p className="auth-error">The account could not be loaded from Supabase Auth. Check the server-only Supabase key and account status.</p>}
      {status.error === "admin-auth-not-configured" && <p className="auth-error">Account updates need the server-only SUPABASE_SERVICE_ROLE_KEY configured in the app hosting environment.</p>}
      {successMessage && <p className="auth-success">{successMessage}</p>}
    </div>
    <section className="admin-panel admin-panel--flush"><div className="admin-table-wrap"><table className="admin-table admin-account-table"><thead><tr><th>Account</th><th>School</th><th>Role</th><th>Status</th><th>Created</th><th>Manage account</th></tr></thead><tbody>{(memberships ?? []).map((membership) => {
      const profile = profileMap.get(String(membership.user_id));
      const role = relation<{ name?: string; slug?: string }>(membership.roles);
      const school = relation<{ name?: string }>(membership.schools);
      const protectedAccount = protectedUserIds.has(String(membership.user_id));
      const availableRoles = (roles ?? []).filter((option) =>
        (option.school_id === null || option.school_id === membership.school_id)
        && !["super_admin", "master_admin"].includes(String(option.slug))
      );
      return <tr key={`${membership.user_id}-${membership.school_id}-${membership.role_id}`}>
        <td><strong>{profile?.full_name ?? "Unnamed account"}</strong><small>{profile?.email ?? String(membership.user_id).slice(0, 12)}</small><small>@{profile?.username ?? "No username"}</small></td>
        <td>{school?.name ?? "-"}</td>
        <td>{role?.name ?? role?.slug ?? "-"}</td>
        <td><span className={`admin-badge ${profile?.is_active ? "admin-badge--positive" : "admin-badge--warning"}`}>{profile?.is_active ? "Active" : "Inactive"}</span></td>
        <td>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "-"}</td>
        <td>{protectedAccount ? <span className="admin-note">Platform admin protected</span> : <AccountEditPanel label="Edit account"><div className="admin-account-actions">
          <form action={updateSchoolUserProfile}>
            <input type="hidden" name="schoolId" value={membership.school_id} />
            <input type="hidden" name="userId" value={membership.user_id} />
            <label>Full name<input name="fullName" defaultValue={profile?.full_name ?? ""} minLength={2} maxLength={120} required /></label>
            <label>User ID / login username<input name="username" defaultValue={profile?.username ?? ""} minLength={3} maxLength={30} pattern="[A-Za-z0-9._-]+" title="3-30 characters: English letters, numbers, dot, dash, underscore. No spaces." aria-describedby={`admin-username-help-${membership.user_id}`} required /><small id={`admin-username-help-${membership.user_id}`}>3–30 characters; letters, numbers, . _ - only. No spaces.</small></label>
            <label>Phone<input name="phone" defaultValue={profile?.phone ?? ""} maxLength={40} /></label>
            <label>School role<select name="roleId" defaultValue={membership.role_id} required>{availableRoles.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
            <button type="submit" className="admin-button admin-button--primary">Save account</button>
          </form>
          <form action={setSchoolUserPassword} className="admin-account-password-form">
            <input type="hidden" name="schoolId" value={membership.school_id} />
            <input type="hidden" name="userId" value={membership.user_id} />
            <h3>Set password directly</h3>
            <label>New password<input type="password" name="password" minLength={8} maxLength={128} autoComplete="new-password" required /></label>
            <label>Confirm password<input type="password" name="confirmPassword" minLength={8} maxLength={128} autoComplete="new-password" required /></label>
            <button type="submit" className="admin-button">Change password</button>
          </form>
        </div></AccountEditPanel>}</td>
      </tr>;
    })}{!memberships?.length && <tr><td colSpan={6}>No school accounts found.</td></tr>}</tbody></table></div></section>
  </AdminShell>;
}

async function BillingPage({ payments = false }: { payments?: boolean }) {
  const { supabase } = await requireMasterAdmin();
  if (payments) {
    const [{ data: paymentsData }, { data: billsData }, { data: schools }] = await Promise.all([
      supabase.from("platform_transactions").select("id,transaction_reference,amount,payment_method,transaction_date,school_id,schools(name),platform_bills(bill_number)").order("transaction_date", { ascending: false }).limit(100),
      supabase.from("platform_bills").select("id,bill_number,total_amount,paid_amount,school_id").order("due_date", { ascending: true }),
      supabase.from("schools").select("id,name").order("name", { ascending: true }),
    ]);
    const customerSchoolIds = (schools ?? []).map((school) => school.id);
    const filteredPayments = filterCustomerSchoolRows(paymentsData ?? [], customerSchoolIds);
    const filteredOutstandingBills = filterCustomerSchoolRows(billsData ?? [], customerSchoolIds)
      .filter((bill) => Number(bill.total_amount) > Number(bill.paid_amount ?? 0));

    return <AdminShell title="Payments" description="Platform transactions recorded against school bills." breadcrumbs={[{ label: "Payments" }]}>
      <section className="admin-panel">
        <div className="admin-panel__heading">
          <div><p className="admin-kicker">Record transaction</p><h2>Register a school bill payment</h2></div>
        </div>
        <form action={recordPlatformTransaction} className="student-form" style={{ marginTop: 12 }}>
          <div className="student-form-grid">
            <label className="student-field">School bill<select name="billId" required>{filteredOutstandingBills.map((bill) => <option key={bill.id} value={bill.id}>{bill.bill_number} / {schools?.find((school) => school.id === bill.school_id)?.name ?? "School"}</option>)}</select></label>
            <label className="student-field">Amount<input type="number" name="amount" min="0.01" step="0.01" required /></label>
            <label className="student-field">Method<select name="paymentMethod" defaultValue="bank_transfer"><option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option><option value="card">Card</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="other">Other</option></select></label>
            <label className="student-field">Transaction date<input type="date" name="transactionDate" required /></label>
            <label className="student-field student-field-wide">Notes<textarea name="notes" rows={3} /></label>
          </div>
          <button type="submit" className="dashboard-action dashboard-action--primary">Record transaction</button>
        </form>
      </section>
      <section className="admin-panel admin-panel--flush"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Reference</th><th>School</th><th>Bill</th><th>Amount</th><th>Method</th><th>Transaction date</th></tr></thead><tbody>{filteredPayments.map((payment) => <tr key={payment.id}><td>{payment.transaction_reference}</td><td>{relation<{ name?: string }>(payment.schools)?.name ?? "-"}</td><td>{relation<{ bill_number?: string }>(payment.platform_bills)?.bill_number ?? "-"}</td><td>{formatCurrency(payment.amount)}</td><td>{String(payment.payment_method).replaceAll("_", " ")}</td><td>{String(payment.transaction_date)}</td></tr>)}{!filteredPayments.length && <tr><td colSpan={6}>No school platform transactions found.</td></tr>}</tbody></table></div></section>
    </AdminShell>;
  }
  const [{ data: billsData }, { data: schools }] = await Promise.all([
    supabase.from("platform_bills").select("id,bill_number,description,total_amount,paid_amount,status,due_date,school_id,schools(name)").order("due_date", { ascending: true }).limit(100),
    supabase.from("schools").select("id,name").order("name", { ascending: true }),
  ]);
  const customerSchoolIds = (schools ?? []).map((school) => school.id);
  const rows = filterCustomerSchoolRows(billsData ?? [], customerSchoolIds);
  const total = rows.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
  const paid = rows.reduce((sum, row) => sum + Number(row.paid_amount ?? 0), 0);
  const due = rows.reduce((sum, row) => sum + Math.max(Number(row.total_amount ?? 0) - Number(row.paid_amount ?? 0), 0), 0);
  return <AdminShell title="Billing" description="School bills and platform charges managed by Master Admin." breadcrumbs={[{ label: "Billing" }]}>
    <section className="admin-kpi-grid"><article className="admin-kpi"><span>Total billed</span><strong>{formatCurrency(total)}</strong><small>Platform bills for schools</small></article><article className="admin-kpi"><span>Total paid</span><strong>{formatCurrency(paid)}</strong><small>Recorded school transactions</small></article><article className="admin-kpi"><span>Total outstanding</span><strong>{formatCurrency(due)}</strong><small>Remaining school bill balances</small></article><article className="admin-kpi"><span>Bills</span><strong>{rows.length}</strong><small>Platform finance records</small></article></section>
    <section className="admin-panel"><div className="admin-panel__heading"><div><p className="admin-kicker">New platform bill</p><h2>Bill a school</h2></div></div><form action={createPlatformBill} className="student-form" style={{ marginTop: 12 }}><div className="student-form-grid"><label className="student-field">School<select name="schoolId" required>{(schools ?? []).map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label><label className="student-field">Bill number<input name="billNumber" required /></label><label className="student-field">Description<input name="description" required /></label><label className="student-field">Amount<input type="number" name="amount" min="0.01" step="0.01" required /></label><label className="student-field">Due date<input type="date" name="dueDate" required /></label></div><button type="submit" className="dashboard-action dashboard-action--primary">Create bill</button></form></section>
    <section className="admin-panel"><div className="admin-panel__heading"><div><p className="admin-kicker">Billing control</p><h2>Reconcile bill status</h2></div></div><form action={reconcilePlatformBills}><button type="submit" className="dashboard-action dashboard-action--primary">Reconcile all bills</button></form></section>
    <section className="admin-panel admin-panel--flush"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Bill</th><th>School</th><th>Description</th><th>Amount</th><th>Paid</th><th>Remaining</th><th>Due</th><th>Status</th></tr></thead><tbody>{rows.map((row) => { const nextState = reconcileInvoiceStatus({ total: Number(row.total_amount ?? 0), paidAmount: Number(row.paid_amount ?? 0), dueDate: String(row.due_date ?? "") }); return <tr key={row.id}><td>{row.bill_number}</td><td>{relation<{ name?: string }>(row.schools)?.name ?? "-"}</td><td>{row.description}</td><td>{formatCurrency(row.total_amount)}</td><td>{formatCurrency(row.paid_amount)}</td><td>{formatCurrency(nextState.remainingAmount)}</td><td>{String(row.due_date)}</td><td><span className="admin-badge admin-badge--neutral">{nextState.status.replaceAll("_", " ")}</span></td></tr>; })}{!rows.length && <tr><td colSpan={8}>No platform bills found for schools.</td></tr>}</tbody></table></div></section>
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

async function ContractsPage() {
  const { supabase } = await requireMasterAdmin();
  const { data } = await supabase.from("platform_contracts").select("id,contract_number,plan_name,pricing_model,monthly_amount,status,start_date,end_date,renewal_date,school_id,schools(name)").order("created_at", { ascending: false }).limit(100);
  const asOfDate = new Date().toISOString().slice(0, 10);
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
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Contract</th><th>School</th><th>Plan</th><th>Price</th><th>Status</th><th>Start</th><th>Renewal</th><th>Actions</th></tr></thead><tbody>{(data ?? []).map((row) => { const state = describeContractLifecycle(row.status, row.renewal_date); const renewalState = resolveContractRenewalWindow({ status: row.status, renewalDate: row.renewal_date, asOf: asOfDate }); return <tr key={row.id}><td>{row.contract_number}</td><td>{relation<{ name?: string }>(row.schools)?.name ?? "-"}</td><td>{row.plan_name}</td><td>{formatCurrency(row.monthly_amount)}</td><td><span className={`admin-badge ${state.isLive ? "admin-badge--positive" : "admin-badge--neutral"}`}>{state.label}{renewalState.isRenewalDue ? " · Due" : renewalState.warns ? " · Warning" : ""}</span></td><td>{String(row.start_date)}</td><td>{row.renewal_date ? String(row.renewal_date) : "—"}</td><td><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><form action={pauseSchoolContract}><input type="hidden" name="contractId" value={row.id} /><button type="submit" className="dashboard-action">Pause</button></form><form action={renewSchoolContract}><input type="hidden" name="contractId" value={row.id} /><input type="date" name="renewalDate" defaultValue={row.renewal_date ?? ""} /><button type="submit" className="dashboard-action dashboard-action--primary">Renew</button></form><form action={cancelSchoolContract}><input type="hidden" name="contractId" value={row.id} /><button type="submit" className="dashboard-action">Cancel</button></form></div></td></tr>; })}{!(data ?? []).length && <tr><td colSpan={8}>No contracts exist yet.</td></tr>}</tbody></table></div>
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
  const [{ data: schools }, { data: invoices }, { data: payments }, { data: roles }, { data: students }, { data: teachers }] = await Promise.all([supabase.from("schools").select("id,is_active"), supabase.from("platform_bills").select("total:total_amount"), supabase.from("platform_transactions").select("amount"), supabase.from("user_roles").select("user_id"), supabase.from("students").select("id"), supabase.from("teachers").select("id")]);
  return <AdminShell title="Reports" description="Global reports assembled from current operational tables." breadcrumbs={[{ label: "Reports" }]}><section className="admin-panel"><div className="admin-panel__heading"><div><p className="admin-kicker">Available reports</p><h2>Platform snapshot</h2></div><a className="admin-button admin-button--primary" href="/reports/export">Export CSV</a></div><div className="admin-report-list"><div><span>Schools report</span><strong>{schools?.length ?? 0} schools · {schools?.filter((school) => school.is_active).length ?? 0} active</strong></div><div><span>Accounts report</span><strong>{new Set((roles ?? []).map((role) => role.user_id)).size} accounts</strong></div><div><span>Billing report</span><strong>{formatCurrency((invoices ?? []).reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0))} billed</strong></div><div><span>Payments report</span><strong>{formatCurrency((payments ?? []).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0))} received</strong></div><div><span>People report</span><strong>{students?.length ?? 0} students · {teachers?.length ?? 0} teachers</strong></div></div></section></AdminShell>;
}

export default async function AdminSectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ error?: string; success?: string; warning?: string }> }) {
  const { section } = await params;
  if (section === "accounts") return <AccountsPage searchParams={searchParams} />;
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
