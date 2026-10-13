import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";

import { AccountDetailActions } from "@/components/admin/account-detail-actions";
import { AdminShell } from "@/components/admin/admin-shell";
import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { isMasterAdminUser } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;
type AccountRole = { id: string; name: string; slug: string };
type AccountSchool = { id: string; name: string };
type AccountPermission = { resource: string; action: string; description: string | null };

function relation<T>(value: Relation<T> | unknown): T | null {
  return Array.isArray(value) ? (value[0] ?? null) as T : (value as T | null);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}

export default async function AdminAccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ school?: string }>;
}) {
  const { userId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const isMasterAdmin = await isMasterAdminUser(supabase, user.id);
  const context = await getActiveSchoolContext(supabase, user.id);
  const requestedSchoolId = (await searchParams).school;
  if (!isMasterAdmin) {
    const schoolId = requestedSchoolId ?? context.schoolId;
    if (!schoolId || schoolId !== context.schoolId) redirect("/users?error=school-required");
    const { data: allowed, error: accessError } = await supabase.rpc("can_manage_account", {
      target_school_id: schoolId,
      target_user_id: userId,
    });
    if (accessError || allowed !== true) redirect("/users?error=not-authorized");
    redirect(`/users/${userId}`);
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return <AdminShell title="Account unavailable" description="Server-side Supabase Auth access is required." breadcrumbs={[{ label: "Accounts", href: isMasterAdmin ? "/admin/accounts" : "/users" }]}>
      <p className="auth-error">Server-side Supabase Auth administration is not configured.</p>
    </AdminShell>;
  }

  const [
    { data: profile, error: profileError },
    { data: authResult, error: authError },
    { data: membershipsData, error: membershipError },
    { data: rolesData, error: rolesError },
    { data: schoolsData, error: schoolsError },
    { data: auditData, error: auditError },
  ] = await Promise.all([
    adminClient.from("profiles").select("id,application_user_id,username,first_name,last_name,full_name,email,phone,avatar_path,account_status,created_at,updated_at").eq("id", userId).maybeSingle(),
    adminClient.auth.admin.getUserById(userId),
    (() => {
      const query = adminClient.from("user_roles").select("school_id,role_id,roles(id,name,slug),schools(id,name)").eq("user_id", userId);
      return !isMasterAdmin && context.schoolId ? query.eq("school_id", context.schoolId) : query;
    })(),
    (() => {
      const query = adminClient.from("roles").select("id,school_id,name,slug").order("name");
      return !isMasterAdmin && context.schoolId ? query.or(`school_id.is.null,school_id.eq.${context.schoolId}`) : query;
    })(),
    (() => {
      const query = adminClient.from("schools").select("id,name").order("name");
      return !isMasterAdmin && context.schoolId ? query.eq("id", context.schoolId) : query;
    })(),
    (() => {
      const query = supabase.from("account_audit_logs").select("id,actor_id,school_id,action,result,metadata,created_at").eq("target_user_id", userId).order("created_at", { ascending: false }).limit(50);
      return !isMasterAdmin && context.schoolId ? query.eq("school_id", context.schoolId) : query;
    })(),
  ]);

  if (profileError || authError || membershipError || rolesError || schoolsError || auditError) {
    return <AdminShell title="Account unavailable" description="The account details could not be loaded." breadcrumbs={[{ label: "Accounts", href: isMasterAdmin ? "/admin/accounts" : "/users" }]}>
      <p className="auth-error">Account details or audit history could not be loaded. Refresh and try again.</p>
    </AdminShell>;
  }
  if (!profile || !authResult.user) notFound();

  const memberships = (membershipsData ?? []).map((membership) => {
    const role = relation<AccountRole>(membership.roles);
    const school = relation<AccountSchool>(membership.schools);
    return {
      school_id: String(membership.school_id),
      school_name: school?.name ?? "School",
      role_id: String(membership.role_id),
      role_name: role?.name ?? role?.slug ?? "Role",
      role_slug: role?.slug ?? "",
    };
  });
  const isProtected = memberships.some((membership) => ["super_admin", "master_admin"].includes(membership.role_slug));
  const roleIds = [...new Set(memberships.map((membership) => membership.role_id))];
  const { data: rolePermissions, error: permissionError } = roleIds.length
    ? await adminClient.from("role_permissions").select("role_id,permissions(resource,action,description)").in("role_id", roleIds)
    : { data: [], error: null };
  if (permissionError) {
    return <AdminShell title="Account unavailable" description="Effective permissions could not be loaded." breadcrumbs={[{ label: "Accounts", href: isMasterAdmin ? "/admin/accounts" : "/users" }]}>
      <p className="auth-error">The account’s effective permissions could not be loaded.</p>
    </AdminShell>;
  }

  const effectivePermissions = new Map<string, AccountPermission[]>();
  for (const entry of rolePermissions ?? []) {
    const roleId = String(entry.role_id);
    const permission = relation<AccountPermission>(entry.permissions);
    if (!permission) continue;
    const list = effectivePermissions.get(roleId) ?? [];
    list.push(permission);
    effectivePermissions.set(roleId, list);
  }

  const avatar = profile.avatar_path
    ? await adminClient.storage.from("profile-avatars").createSignedUrl(profile.avatar_path, 60 * 10)
    : { data: null, error: null };
  const authUser = authResult.user;
  const roles = rolesData ?? [];
  const schools = schoolsData ?? [];
  const accountsHref = isMasterAdmin ? "/admin/accounts" : "/users";

  return (
    <AdminShell
      title={profile.full_name ?? profile.username ?? "User account"}
      description="Supabase Auth identity, Schooliva profile, school memberships, permissions, and security history."
      breadcrumbs={[{ label: "Accounts", href: accountsHref }, { label: profile.full_name ?? profile.username ?? "Account" }]}
    >
      <div className="account-detail-header">
        <div className="admin-account-profile">
          {avatar.data?.signedUrl
            ? <Image src={avatar.data.signedUrl} alt="" width={72} height={72} unoptimized className="admin-account-avatar admin-account-avatar--large" />
            : <span className="admin-account-avatar admin-account-avatar--large">{(profile.full_name ?? "A").charAt(0).toUpperCase()}</span>}
          <div>
            <p className="admin-kicker">Account overview</p>
            <h2>{profile.full_name ?? "Unnamed account"}</h2>
            <div className="account-detail-meta">
              <span className={`admin-badge admin-badge--${profile.account_status === "active" ? "positive" : "warning"}`}>{profile.account_status}</span>
              <span>@{profile.username ?? "no-username"}</span>
              <span>{memberships.length} {memberships.length === 1 ? "school" : "schools"}</span>
            </div>
          </div>
        </div>
        <Link className="admin-button" href={accountsHref}>Back to accounts</Link>
      </div>

      {avatar.error && <p className="auth-error">The private profile photo could not be displayed.</p>}

      <nav className="account-detail-nav" aria-label="Account sections">
        <Link href="#identity">Profile</Link><Link href="#authentication">Authentication</Link><Link href="#memberships">School access</Link><Link href="#profile">Manage</Link><Link href="#activity">Activity</Link>
      </nav>

      <section id="identity" className="admin-panel account-detail-panel">
        <header className="admin-panel__heading"><div><p className="admin-kicker">Profile</p><h2>Identity</h2></div></header>
        <dl className="account-identity-grid">
          <div><dt>First name</dt><dd>{profile.first_name ?? "-"}</dd></div>
          <div><dt>Last name</dt><dd>{profile.last_name ?? "-"}</dd></div>
          <div><dt>Application User ID</dt><dd>{profile.application_user_id}</dd></div>
          <div><dt>Username / login ID</dt><dd>{profile.username ?? "-"}</dd></div>
          <div><dt>Email</dt><dd>{authUser.email ?? profile.email ?? "-"}</dd></div>
          <div><dt>Phone</dt><dd>{profile.phone ?? "-"}</dd></div>
          <div><dt>Supabase Auth UUID</dt><dd><code>{profile.id}</code><small>Permanent internal identity; it cannot be changed.</small></dd></div>
        </dl>
      </section>

      <section id="authentication" className="admin-panel account-detail-panel">
        <header className="admin-panel__heading"><div><p className="admin-kicker">Account</p><h2>Authentication status</h2></div></header>
        <dl className="account-identity-grid">
          <div><dt>Account status</dt><dd>{profile.account_status}</dd></div>
          <div><dt>Supabase Auth</dt><dd><span className={`account-inline-status ${authUser.banned_until ? "is-blocked" : "is-enabled"}`}><i />{authUser.banned_until ? "Blocked by Auth" : "Enabled"}</span></dd></div>
          <div><dt>Email verification</dt><dd>{authUser.email_confirmed_at ? `Verified ${formatDate(authUser.email_confirmed_at)}` : "Not verified"}</dd></div>
          <div><dt>Account created</dt><dd>{formatDate(authUser.created_at)}</dd></div>
          <div><dt>Last login</dt><dd>{formatDate(authUser.last_sign_in_at)}</dd></div>
          <div><dt>Last updated</dt><dd>{formatDate(profile.updated_at)}</dd></div>
        </dl>
      </section>

      <section id="memberships" className="admin-panel account-detail-panel">
        <header className="admin-panel__heading"><div><p className="admin-kicker">Membership</p><h2>Schools and roles</h2></div></header>
        {memberships.length
          ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>School</th><th>Role</th><th>Effective permissions</th></tr></thead><tbody>
              {memberships.map((membership) => {
                const permissions = effectivePermissions.get(membership.role_id) ?? [];
                return <tr key={`${membership.school_id}-${membership.role_id}`}>
                  <td>{membership.school_name}</td><td>{membership.role_name}</td>
                  <td>{permissions.length ? [...new Set(permissions.map((permission) => `${permission.resource}:${permission.action}`))].sort().join(", ") : "No role permissions assigned"}</td>
                </tr>;
              })}
            </tbody></table></div>
          : <p className="admin-note">This profile has no school membership.</p>}
      </section>

      <div id="account-actions" className="account-actions-anchor"><p className="admin-kicker">Account controls</p><h2>Manage this account</h2><p>Changes are recorded in the account audit history below.</p></div>
      <AccountDetailActions
        userId={profile.id}
        fullName={profile.full_name ?? ""}
        applicationUserId={profile.application_user_id}
        username={profile.username ?? ""}
        firstName={profile.first_name ?? ""}
        lastName={profile.last_name ?? ""}
        phone={profile.phone ?? ""}
        email={authUser.email ?? profile.email ?? ""}
        status={profile.account_status}
        memberships={memberships}
        schools={schools}
        roles={roles}
        isProtected={isProtected}
        isMasterAdmin={isMasterAdmin}
      />

      <section id="activity" className="admin-panel account-detail-panel">
        <header className="admin-panel__heading"><div><p className="admin-kicker">Activity</p><h2>Account audit history</h2></div></header>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>When</th><th>Actor</th><th>School</th><th>Action</th><th>Result</th><th>Safe details</th></tr></thead><tbody>
          {(auditData ?? []).map((event) => (
            <tr key={event.id}>
              <td>{formatDate(event.created_at)}</td><td>{event.actor_id ?? "System"}</td><td>{event.school_id ?? "Platform"}</td>
              <td>{event.action}</td><td>{event.result}</td><td><code>{JSON.stringify(event.metadata ?? {})}</code></td>
            </tr>
          ))}
          {!auditData?.length && <tr><td colSpan={6}>No account activity has been recorded.</td></tr>}
        </tbody></table></div>
      </section>
    </AdminShell>
  );
}
