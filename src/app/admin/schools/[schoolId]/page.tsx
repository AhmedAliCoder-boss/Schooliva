import Link from "next/link";
import { redirect } from "next/navigation";

import { activateSchoolLifecycle } from "@/app/actions/admin";
import { AdminShell, AdminWorkflowNotice } from "@/components/admin/admin-shell";
import { SchoolBrandingEditor } from "@/components/admin/school-branding-editor";
import { buildBrandingTheme, getSchoolBrandingForSchool } from "@/lib/school-branding";
import { resolveSchoolLifecycle } from "@/lib/school-lifecycle";
import { createClient } from "@/lib/supabase/server";
import { isMasterAdminUser } from "@/lib/auth/roles";

export default async function SchoolDetailPage({ params, searchParams }: { params: Promise<{ schoolId: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ schoolId }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const isAdmin = await isMasterAdminUser(supabase, user.id);
  if (!isAdmin) redirect("/dashboard?error=not-authorized");

  const { data: school } = await supabase.from("schools").select("id,name,code,email,phone,address,city,state,country,is_active,created_at").eq("id", schoolId).maybeSingle();
  if (!school) redirect("/admin/schools");

  const { data: brandingRecord } = await supabase.from("school_branding").select("primary_color,secondary_color,accent_color,background_color,foreground_color,card_color,muted_color,border_color,success_color,warning_color,destructive_color,info_color,theme_mode,logo_path").eq("school_id", schoolId).maybeSingle();
  const brandingTheme = brandingRecord ? buildBrandingTheme({
    primaryColor: brandingRecord.primary_color,
    secondaryColor: brandingRecord.secondary_color,
    accentColor: brandingRecord.accent_color,
    backgroundColor: brandingRecord.background_color,
    foregroundColor: brandingRecord.foreground_color,
    cardColor: brandingRecord.card_color,
    mutedColor: brandingRecord.muted_color,
    borderColor: brandingRecord.border_color,
    successColor: brandingRecord.success_color,
    warningColor: brandingRecord.warning_color,
    destructiveColor: brandingRecord.destructive_color,
    infoColor: brandingRecord.info_color,
    themeMode: brandingRecord.theme_mode,
  }) : undefined;
  const brandingFormTheme = brandingTheme ?? buildBrandingTheme({
    primaryColor: "#2563eb",
    secondaryColor: "#0f172a",
    accentColor: "#f59e0b",
    backgroundColor: "#f8fafc",
    foregroundColor: "#0f172a",
    cardColor: "#ffffff",
    mutedColor: "#64748b",
    borderColor: "#dfe7ee",
    successColor: "#16a34a",
    warningColor: "#f59e0b",
    destructiveColor: "#dc2626",
    infoColor: "#2563eb",
    themeMode: "light",
  });
  const brandingProfile = await getSchoolBrandingForSchool(supabase, schoolId);

  const [{ data: memberships }, { data: students }, { data: teachers }, { data: documents }, { data: contracts }, { data: trials }] = await Promise.all([
    supabase.from("user_roles").select("user_id,created_at,role_id,roles(name,slug)").eq("school_id", schoolId),
    supabase.from("students").select("id,first_name,last_name,status").eq("school_id", schoolId),
    supabase.from("teachers").select("id,first_name,last_name,is_active").eq("school_id", schoolId),
    supabase.from("school_documents").select("id,file_size").eq("school_id", schoolId),
    supabase.from("platform_contracts").select("id,contract_number,plan_name,status,monthly_amount,start_date,renewal_date").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(10),
    supabase.from("school_trials").select("id,trial_name,status,starts_on,ends_on,seats").eq("school_id", schoolId).order("starts_on", { ascending: false }).limit(10),
  ]);

  const { data: profiles } = await supabase.from("profiles").select("id,application_user_id,full_name,email,account_status,created_at").in("id", (memberships ?? []).map((row) => row.user_id));
  const profileMap = new Map((profiles ?? []).map((row) => [String(row.id), row]));
  const storageUsed = (documents ?? []).reduce((sum, doc) => sum + Number(doc.file_size ?? 0), 0);
  const activeMembers = (memberships ?? []).filter((row) => profileMap.get(String(row.user_id))?.account_status === "active").length;
  const activeContract = (contracts ?? [])[0];
  const activeTrial = (trials ?? [])[0];
  const lifecycleState = resolveSchoolLifecycle({
    contractStatus: activeContract?.status,
    trialStatus: activeTrial?.status,
    contractPlanName: activeContract?.plan_name,
    trialName: activeTrial?.trial_name,
  });
  const roleCounts = new Map<string, number>();
  for (const membership of memberships ?? []) {
    const roleName = (membership.roles as { name?: string } | null)?.name ?? "Role";
    roleCounts.set(roleName, (roleCounts.get(roleName) ?? 0) + 1);
  }

    return (
    <AdminShell title={school.name} description="A controlled view of this tenant. School-specific actions stay scoped to the selected school." breadcrumbs={[{ label: "Schools", href: "/admin/schools" }, { label: school.name }]} schoolContext={school.name} brandingTheme={brandingTheme}>
        <AdminWorkflowNotice code={query.success} success />
        <AdminWorkflowNotice code={query.error} />
      <section className="admin-toolbar"><div><span className="admin-toolbar__count">School management</span><span className="admin-toolbar__hint">{school.code} · {school.is_active ? "Active tenant" : "Inactive tenant"}</span></div><Link href={`/admin/schools/${schoolId}/dashboard`} className="admin-button admin-button--primary">Open School Dashboard →</Link></section>
      <section className="admin-kpi-grid">
        <article className="admin-kpi"><span>Total accounts</span><strong>{String((memberships ?? []).length)}</strong><small>Selected school</small></article>
        <article className="admin-kpi"><span>Active accounts</span><strong>{String(activeMembers)}</strong><small>Profile status</small></article>
        <article className="admin-kpi"><span>Students</span><strong>{String((students ?? []).length)}</strong><small>School records</small></article>
        <article className="admin-kpi"><span>Teachers</span><strong>{String((teachers ?? []).length)}</strong><small>School records</small></article>
      </section>

      <section className="admin-panel" style={{ marginTop: 24 }}>
        <div className="dashboard-card-heading">
          <div><span className="dashboard-panel-kicker">School information</span><h2>{school.name}</h2></div>
        </div>
        <div className="student-form-grid" style={{ marginTop: 12 }}>
          <div className="student-field"><label>Code</label><span>{school.code}</span></div>
          <div className="student-field"><label>Status</label><span>{school.is_active ? "Active" : "Inactive"}</span></div>
          <div className="student-field"><label>Contact</label><span>{school.email ?? school.phone ?? "-"}</span></div>
          <div className="student-field"><label>Location</label><span>{[school.city, school.state, school.country].filter(Boolean).join(", ") || "-"}</span></div>
          <div className="student-field"><label>Created</label><span>{new Date(String(school.created_at)).toLocaleDateString()}</span></div>
        </div>
      </section>

      <section className="admin-panel" style={{ marginTop: 24 }}>
        <div className="dashboard-card-heading">
          <div><span className="dashboard-panel-kicker">Create user</span><h2>Add account for this school</h2></div>
        </div>
        <p className="account-form-note">New users are created through Supabase Auth and linked to this school with a database-backed role.</p>
        <Link className="admin-button admin-button--primary" href={`/admin/accounts/new?school=${schoolId}`}>Create school account</Link>
      </section>

      <section className="admin-panel" style={{ marginTop: 24 }}>
        <div className="dashboard-card-heading">
          <div><span className="dashboard-panel-kicker">School accounts</span><h2>Users assigned to this school</h2></div>
        </div>
        <div className="student-table-wrap" style={{ marginTop: 16 }}>
          <table className="student-table">
            <thead>
              <tr>
                <th>Application User ID</th>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(memberships ?? []).length ? (memberships ?? []).map((membership) => {
                const profile = profileMap.get(String(membership.user_id));
                const roleName = (membership.roles as { name?: string } | null)?.name ?? "Role";
                return (
                  <tr key={String(membership.user_id)}>
                    <td>{profile?.application_user_id ?? "-"}</td>
                    <td>{profile?.full_name ?? "User"}</td>
                    <td>{roleName}</td>
                    <td><span className={`status-pill ${profile?.account_status === "active" ? "active" : "inactive"}`}>{profile?.account_status ?? "Unknown"}</span></td>
                    <td>{profile ? new Date(String(profile.created_at)).toLocaleDateString() : "-"}</td>
                    <td><Link className="admin-button" href={`/admin/accounts/${String(membership.user_id)}`}>Manage account</Link></td>
                  </tr>
                );
              }) : <tr><td colSpan={6}><div className="student-empty"><h3>No accounts found</h3><p>No users are assigned to this school yet.</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel" style={{ marginTop: 24 }}>
        <div className="dashboard-card-heading">
          <div><span className="dashboard-panel-kicker">Branding & appearance</span><h2>School identity</h2></div>
        </div>
        <SchoolBrandingEditor schoolId={schoolId} schoolName={school.name} initialTheme={brandingFormTheme} logoUrl={brandingProfile?.logoUrl ?? null} />
      </section>

      <section className="admin-panel" style={{ marginTop: 24 }}>
        <div className="dashboard-card-heading">
          <div><span className="dashboard-panel-kicker">School storage</span><h2>Storage usage</h2></div>
        </div>
        <p style={{ marginTop: 12 }}>Used: {storageUsed ? `${storageUsed} bytes` : "No storage records available."}</p>
      </section>

      <section className="admin-panel" style={{ marginTop: 24 }}>
        <div className="dashboard-card-heading">
          <div><span className="dashboard-panel-kicker">Contract & trial snapshot</span><h2>Tenant lifecycle</h2></div>
        </div>
        <div className="student-form-grid" style={{ marginTop: 12 }}>
          <div className="student-field"><label>Current lifecycle</label><span>{lifecycleState.label}</span></div>
          <div className="student-field"><label>Active contract</label><span>{activeContract ? `${activeContract.plan_name} · ${activeContract.status}` : "No contract on file"}</span></div>
          <div className="student-field"><label>Current trial</label><span>{activeTrial ? `${activeTrial.trial_name} · ${activeTrial.status}` : "No active trial"}</span></div>
        </div>
        <form action={activateSchoolLifecycle} className="student-form" style={{ marginTop: 16 }}>
          <input type="hidden" name="schoolId" value={schoolId} />
          <input type="hidden" name="trialId" value={activeTrial?.id ?? ""} />
          <div className="student-form-grid">
            <label className="student-field">Plan name<input name="planName" defaultValue={activeContract?.plan_name ?? "Starter"} required /></label>
            <label className="student-field">Contract reference (optional)<input name="contractNumber" placeholder="Auto-generated: SC-26-0001" /></label>
            <label className="student-field">Billing cycle<select name="pricingModel" defaultValue="monthly"><option value="monthly">Monthly</option><option value="annual">Annual</option><option value="custom">Custom / manual</option></select></label>
            <label className="student-field">Monthly equivalent<input type="number" name="monthlyAmount" step="0.01" min="0.01" defaultValue={Number(activeContract?.monthly_amount ?? 0) || ""} required /></label>
            <label className="student-field">Contract end date<input type="date" name="endDate" /></label>
          </div>
          <p className="account-form-note">This prepares the agreement and first bill. School access is enabled only after the full bill is recorded as paid. The trial remains available until its end date. Custom terms require an end date and are billed manually.</p>
          <button type="submit" className="dashboard-action dashboard-action--primary">Prepare contract & first bill</button>
        </form>
      </section>
    </AdminShell>
  );
}
