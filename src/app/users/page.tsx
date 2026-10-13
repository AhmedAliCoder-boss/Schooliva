import Link from "next/link";

import { requireSchoolAccountManager } from "@/lib/admin/school-account-context";
import { SCHOOL_MANAGED_ACCOUNT_ROLE_SLUGS } from "@/lib/auth/roles";

function relation<T>(value: unknown): T | null {
  return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null;
}

export default async function UserManagementPage() {
  const { supabase, schoolId, schoolName } = await requireSchoolAccountManager();

  const { data: memberships, error: membershipsError } = await supabase
    .from("user_roles")
    .select("user_id,role_id,roles(id,name,slug)")
    .eq("school_id", schoolId)
    .order("user_id");
  if (membershipsError) {
    return <main className="user-management-page"><header className="page-header"><div><p className="page-header__eyebrow">Administration</p><h1>User accounts</h1></div></header><p className="auth-error">School user accounts could not be loaded.</p></main>;
  }

  const staffMemberships = (memberships ?? []).filter((membership) => {
    const role = relation<{ slug?: string }>(membership.roles);
    return SCHOOL_MANAGED_ACCOUNT_ROLE_SLUGS.includes(
      role?.slug as (typeof SCHOOL_MANAGED_ACCOUNT_ROLE_SLUGS)[number],
    );
  });
  const candidateUserIds = [...new Set(staffMemberships.map((membership) => String(membership.user_id)))]
    .filter((userId) => memberships
      ?.filter((membership) => String(membership.user_id) === userId)
      .every((membership) => {
        const role = relation<{ slug?: string }>(membership.roles);
        return SCHOOL_MANAGED_ACCOUNT_ROLE_SLUGS.includes(
          role?.slug as (typeof SCHOOL_MANAGED_ACCOUNT_ROLE_SLUGS)[number],
        );
      }));
  const accessChecks = await Promise.all(candidateUserIds.map(async (userId) => {
    const { data, error } = await supabase.rpc("can_manage_account", {
      target_school_id: schoolId,
      target_user_id: userId,
    });
    return { userId, allowed: data === true, error };
  }));
  if (accessChecks.some((check) => check.error)) {
    return <main className="user-management-page"><header className="page-header"><div><p className="page-header__eyebrow">Administration</p><h1>User accounts</h1></div></header><p className="auth-error">School account access could not be verified.</p></main>;
  }
  const userIds = accessChecks.filter((check) => check.allowed).map((check) => check.userId);
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase.from("profiles").select("id,application_user_id,full_name,username,phone,email,account_status").in("id", userIds).order("full_name")
    : { data: [], error: null };
  if (profilesError) {
    return <main className="user-management-page"><header className="page-header"><div><p className="page-header__eyebrow">Administration</p><h1>User accounts</h1></div></header><p className="auth-error">School account details could not be loaded.</p></main>;
  }

  const profileMap = new Map((profiles ?? []).map((row) => [String(row.id), row]));
  const accessibleIds = new Set(userIds);
  const uniqueMemberships = staffMemberships.filter((membership, index, all) =>
    accessibleIds.has(String(membership.user_id))
    &&
    all.findIndex((candidate) => candidate.user_id === membership.user_id) === index
  );

  return <main className="user-management-page">
    <header className="page-header"><div><p className="page-header__eyebrow">Administration / {schoolName}</p><h1>User accounts</h1><p>View and manage eligible accounts assigned only to this school.</p></div><Link className="admin-button admin-button--primary" href="/users/new">Create school account</Link></header>
    <section className="user-management-list" aria-label="School accounts">
      {uniqueMemberships.map((membership) => {
        const account = profileMap.get(String(membership.user_id));
        const role = relation<{ id?: string; name?: string; slug?: string }>(membership.roles);
        return <article className="user-management-card" key={`${membership.user_id}-${membership.role_id}`}>
          <header><div><h2>{account?.full_name ?? "Unnamed account"}</h2><p>{account?.email ?? "Email unavailable"}</p><small>@{account?.username ?? "No username"}</small></div><span className="user-management-role">{role?.name ?? role?.slug ?? "Member"}</span></header>
          <dl className="account-identity-grid">
            <div><dt>Application User ID</dt><dd>{account?.application_user_id ?? "-"}</dd></div>
            <div><dt>Account status</dt><dd>{account?.account_status ?? "Unknown"}</dd></div>
            <div><dt>Phone</dt><dd>{account?.phone ?? "-"}</dd></div>
          </dl>
          <Link className="admin-button" href={`/users/${String(membership.user_id)}`}>Manage account</Link>
        </article>;
      })}
      {!uniqueMemberships.length && <p className="dashboard-muted">No staff accounts are assigned to this school.</p>}
    </section>
  </main>;
}
