import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AccountDetailActions } from "@/components/admin/account-detail-actions";
import { requireSchoolAccountManager } from "@/lib/admin/school-account-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SCHOOL_MANAGED_ACCOUNT_ROLE_SLUGS } from "@/lib/auth/roles";

type Role = { id: string; name: string; slug: string };

function relation<T>(value: unknown): T | null {
  return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}

export default async function SchoolAccountDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) notFound();
  const { supabase, user, schoolId, schoolName } = await requireSchoolAccountManager();
  const { data: canManage, error: accessError } = await supabase.rpc("can_manage_account", {
    target_school_id: schoolId,
    target_user_id: userId,
  });
  if (accessError) {
    return <main className="user-management-page"><p className="auth-error">School account access could not be verified.</p></main>;
  }
  if (canManage !== true || user.id === userId) redirect("/users?error=not-authorized");

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return <main className="user-management-page"><p className="auth-error">School account management is temporarily unavailable.</p></main>;
  }

  const [
    { data: profile, error: profileError },
    { data: authResult, error: authError },
    { data: membershipData, error: membershipError },
    { data: rolesData, error: rolesError },
    { data: school, error: schoolError },
    { data: auditData, error: auditError },
  ] = await Promise.all([
    adminClient.from("profiles")
      .select("id,application_user_id,username,first_name,last_name,full_name,email,phone,avatar_path,account_status")
      .eq("id", userId).maybeSingle(),
    adminClient.auth.admin.getUserById(userId),
    supabase.from("user_roles").select("school_id,role_id,roles(id,name,slug),schools(id,name)")
      .eq("user_id", userId).eq("school_id", schoolId),
    supabase.from("roles").select("id,school_id,name,slug")
      .or(`school_id.is.null,school_id.eq.${schoolId}`).order("name"),
    supabase.from("schools").select("id,name").eq("id", schoolId).maybeSingle(),
    supabase.from("account_audit_logs").select("id,actor_id,school_id,action,result,metadata,created_at")
      .eq("target_user_id", userId).eq("school_id", schoolId).order("created_at", { ascending: false }).limit(50),
  ]);

  if (profileError || authError || membershipError || rolesError || schoolError || auditError) {
    return <main className="user-management-page"><p className="auth-error">School account details could not be loaded. Refresh and try again.</p></main>;
  }
  if (!profile || !authResult.user || !school) notFound();

  const memberships = (membershipData ?? []).map((membership) => {
    const role = relation<Role>(membership.roles);
    const membershipSchool = relation<{ id: string; name: string }>(membership.schools);
    return {
      school_id: String(membership.school_id),
      school_name: membershipSchool?.name ?? school.name,
      role_id: String(membership.role_id),
      role_name: role?.name ?? role?.slug ?? "Role",
      role_slug: role?.slug ?? "",
    };
  });
  if (!memberships.length || memberships.some((membership) =>
    !SCHOOL_MANAGED_ACCOUNT_ROLE_SLUGS.includes(membership.role_slug as (typeof SCHOOL_MANAGED_ACCOUNT_ROLE_SLUGS)[number])
  )) {
    redirect("/users?error=not-authorized");
  }
  const roles = (rolesData ?? []).filter((role) =>
    SCHOOL_MANAGED_ACCOUNT_ROLE_SLUGS.includes(role.slug as (typeof SCHOOL_MANAGED_ACCOUNT_ROLE_SLUGS)[number])
  );
  const avatar = profile.avatar_path
    ? await adminClient.storage.from("profile-avatars").createSignedUrl(profile.avatar_path, 60 * 10)
    : { data: null, error: null };
  return <main className="user-management-page">
    <header className="page-header">
      <div><p className="page-header__eyebrow">{school.name || schoolName} / School accounts</p><h1>Manage school account</h1><p>Only this school’s eligible staff account is shown here.</p></div>
      <Link className="admin-button" href="/users">Back to school accounts</Link>
    </header>
    <section className="admin-panel account-detail-panel">
      <header className="account-detail-header">
        <div className="admin-account-profile">
          {avatar.data?.signedUrl
            ? <Image src={avatar.data.signedUrl} alt="" width={72} height={72} unoptimized className="admin-account-avatar admin-account-avatar--large" />
            : <span className="admin-account-avatar admin-account-avatar--large">{(profile.full_name ?? "A").charAt(0).toUpperCase()}</span>}
          <div>
            <p className="admin-kicker">{school.name}</p>
            <h2>{profile.full_name ?? "Unnamed account"}</h2>
            <div className="account-detail-meta">
              <span className={`admin-badge admin-badge--${profile.account_status === "active" ? "positive" : "warning"}`}>{profile.account_status}</span>
              <span>@{profile.username ?? "no-username"}</span>
              <span>{memberships.map((membership) => membership.role_name).join(", ")}</span>
            </div>
          </div>
        </div>
      </header>
      {avatar.error && <p className="auth-error">The private profile photo could not be displayed.</p>}
      <dl className="account-identity-grid">
        <div><dt>User ID</dt><dd>{profile.application_user_id}</dd></div>
        <div><dt>Email</dt><dd>{authResult.user.email ?? profile.email ?? "-"}</dd></div>
        <div><dt>Phone</dt><dd>{profile.phone ?? "-"}</dd></div>
        <div><dt>Account status</dt><dd>{profile.account_status}</dd></div>
        <div><dt>Created</dt><dd>{formatDate(authResult.user.created_at)}</dd></div>
        <div><dt>Last sign in</dt><dd>{formatDate(authResult.user.last_sign_in_at)}</dd></div>
      </dl>
    </section>
    <AccountDetailActions
      userId={profile.id}
      fullName={profile.full_name ?? ""}
      applicationUserId={profile.application_user_id}
      username={profile.username ?? ""}
      firstName={profile.first_name ?? ""}
      lastName={profile.last_name ?? ""}
      phone={profile.phone ?? ""}
      email={authResult.user.email ?? profile.email ?? ""}
      status={profile.account_status}
      memberships={memberships}
      schools={[school]}
      roles={roles}
      isProtected={false}
      isMasterAdmin={false}
    />
    <section id="activity" className="admin-panel account-detail-panel">
      <header className="admin-panel__heading"><div><p className="admin-kicker">{school.name}</p><h2>School account activity</h2></div></header>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>When</th><th>Action</th><th>Result</th><th>Details</th></tr></thead><tbody>
        {(auditData ?? []).map((event) => <tr key={event.id}>
          <td>{formatDate(event.created_at)}</td><td>{event.action}</td><td>{event.result}</td><td><code>{JSON.stringify(event.metadata ?? {})}</code></td>
        </tr>)}
        {!auditData?.length && <tr><td colSpan={4}>No school account activity has been recorded.</td></tr>}
      </tbody></table></div>
    </section>
  </main>;
}
