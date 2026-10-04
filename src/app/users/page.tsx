import { redirect } from "next/navigation";

import { setSchoolUserPassword, updateSchoolUserProfile } from "@/app/actions/user-management";
import { AccountEditPanel } from "@/components/admin/account-edit-panel";
import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { isMasterAdminUser } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ error?: string; success?: string; warning?: string }>;

function relation<T>(value: unknown): T | null {
  return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null;
}

export default async function UserManagementPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const context = await getActiveSchoolContext(supabase, user.id);
  if (!context.schoolId) {
    redirect(context.isMasterAdmin ? "/admin/accounts" : "/dashboard?error=school-required");
  }
  const isMasterAdmin = await isMasterAdminUser(supabase, user.id);
  const { data: allowed, error: permissionError } = isMasterAdmin
    ? { data: true, error: null }
    : await supabase.rpc("has_permission", {
      target_school_id: context.schoolId,
      target_resource: "users",
      target_action: "manage",
    });
  if (permissionError || !allowed) redirect("/dashboard?error=not-authorized");

  const [{ data: memberships, error: membershipsError }, { data: roles, error: rolesError }] = await Promise.all([
    supabase.from("user_roles").select("user_id,role_id,roles(id,name,slug)").eq("school_id", context.schoolId).order("user_id"),
    supabase.from("roles").select("id,name,slug").or(`school_id.is.null,school_id.eq.${context.schoolId}`).order("name"),
  ]);
  if (membershipsError || rolesError) {
    return <main className="user-management-page"><header className="page-header"><div><p className="page-header__eyebrow">Administration</p><h1>User accounts</h1></div></header><p className="auth-error">School user accounts could not be loaded.</p></main>;
  }

  const userIds = [...new Set((memberships ?? []).map((membership) => String(membership.user_id)))];
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase.from("profiles").select("id,full_name,username,phone,email").in("id", userIds).order("full_name")
    : { data: [], error: null };
  if (profilesError) {
    return <main className="user-management-page"><header className="page-header"><div><p className="page-header__eyebrow">Administration</p><h1>User accounts</h1></div></header><p className="auth-error">School account details could not be loaded.</p></main>;
  }

  const profileMap = new Map((profiles ?? []).map((row) => [String(row.id), row]));
  const availableRoles = (roles ?? []).filter((role) => !["super_admin", "master_admin"].includes(String(role.slug)));
  const uniqueMemberships = (memberships ?? []).filter((membership, index, all) =>
    all.findIndex((candidate) => candidate.user_id === membership.user_id) === index
  );
  const status = await searchParams;
  const successMessage = status.success === "profile-updated"
    ? "Account profile and role were updated."
    : status.success === "password-updated"
      ? "Account password changed."
      : null;
  const errorMessage = status.error === "admin-auth-not-configured"
    ? "Direct password changes are not enabled yet. Ask the platform owner to set the server-only SUPABASE_SERVICE_ROLE_KEY."
    : status.error === "invalid-username"
      ? "Username save nahi hua: 3–30 characters use karein; sirf English letters, numbers, dot (.), dash (-), ya underscore (_) allowed hain. Spaces nahi."
      : status.error === "invalid-full-name"
        ? "Full name kam se kam 2 characters ka hona chahiye aur 120 characters se zyada nahi ho sakta."
        : status.error === "invalid-role"
          ? "Selected school role valid nahi hai. Account dobara khol kar role select karein."
          : status.error === "invalid-phone"
            ? "Phone number 40 characters se zyada nahi ho sakta."
            : status.error === "invalid-school-reference"
              ? "School account link invalid hai. Page refresh karein; agar phir bhi issue ho to Master Admin se contact karein."
              : status.error === "invalid-user-reference"
                ? "Account reference invalid hai. Accounts page refresh karke account dobara kholen."
                : status.error === "school-selection-required"
                  ? "School context select nahi hai. Dashboard par apna school select karke account dobara edit karein."
                  : status.error === "school-lookup-failed"
                    ? "Account ka school lookup nahi ho saka. Page refresh karke dobara try karein."
        : status.error === "invalid-account-details" || status.error === "invalid-profile"
          ? "MBSadmin valid username hai. Username issue nahi hai; edit drawer band karke account dobara kholen aur full name aur school role check karke save karein."
    : status.error === "password-update-failed"
      ? "Password change failed. Check that the new password meets your Supabase Auth password policy."
      : status.error === "invalid-password"
        ? "Password must be at least 8 characters, match its confirmation, and belong to another account."
        : status.error;

  return <main className="user-management-page">
    <header className="page-header"><div><p className="page-header__eyebrow">Administration / {context.schoolName ?? "School"}</p><h1>User accounts</h1><p>Manage profiles and school roles, or set a new account password directly.</p></div></header>
    <div className="user-management-messages" aria-live="polite">
      {errorMessage && <p className="auth-error">{errorMessage}</p>}
      {status.warning === "audit-failed" && <p className="auth-error">The account change completed, but its audit event could not be recorded. Please contact support.</p>}
      {status.warning === "password-audit-failed" && <p className="auth-error">Password changed, but the audit event could not be recorded. Please contact support.</p>}
      {status.warning === "login-username-sync-failed" && <p className="auth-error">The database profile changed, but login metadata could not be synchronized. Re-save the account or check the server-only Supabase key.</p>}
      {status.error === "profile-update-not-verified" && <p className="auth-error">The account update could not be verified in the database. No success was reported; refresh and try again.</p>}
      {status.error === "account-auth-unavailable" && <p className="auth-error">The account could not be loaded from Supabase Auth. Check the server-only Supabase key and account status.</p>}
      {status.error === "admin-auth-not-configured" && <p className="auth-error">Account updates need the server-only SUPABASE_SERVICE_ROLE_KEY configured in the app hosting environment.</p>}
      {successMessage && <p className="auth-success">{successMessage}</p>}
    </div>
    <section className="user-management-list" aria-label="School accounts">
      {uniqueMemberships.map((membership) => {
        const account = profileMap.get(String(membership.user_id));
        const role = relation<{ id?: string; name?: string; slug?: string }>(membership.roles);
        const isProtected = role?.slug === "super_admin" || role?.slug === "master_admin";
        const isSelf = String(membership.user_id) === user.id;
        return <article className="user-management-card" key={`${membership.user_id}-${membership.role_id}`}>
          <header><div><h2>{account?.full_name ?? "Unnamed account"}</h2><p>{account?.email ?? "Email unavailable"}</p><small>@{account?.username ?? "No username"}</small></div><span className="user-management-role">{role?.name ?? role?.slug ?? "Member"}</span></header>
          {isProtected
            ? <p className="admin-note">Platform administrator accounts are protected.</p>
            : <AccountEditPanel label="Edit account"><div className="user-management-card__body">
              <form action={updateSchoolUserProfile} className="user-management-form">
                <input type="hidden" name="schoolId" value={String(context.schoolId)} />
                <input type="hidden" name="userId" value={membership.user_id} />
                <label>Full name<input name="fullName" defaultValue={account?.full_name ?? ""} minLength={2} maxLength={120} required /></label>
                <label>User ID / login username<input name="username" defaultValue={account?.username ?? ""} minLength={3} maxLength={30} pattern="[A-Za-z0-9._-]+" title="3-30 characters: English letters, numbers, dot, dash, underscore. No spaces." aria-describedby={`username-help-${membership.user_id}`} required /><small id={`username-help-${membership.user_id}`}>3–30 characters; letters, numbers, . _ - only. No spaces.</small></label>
                <label>Phone<input name="phone" defaultValue={account?.phone ?? ""} maxLength={40} /></label>
                <label>School role<select name="roleId" defaultValue={membership.role_id} required>{availableRoles.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
                <button type="submit" className="dashboard-action dashboard-action--primary" disabled={isSelf}>Save changes</button>
                {isSelf && <small>Your own school role cannot be changed here.</small>}
              </form>
              <form action={setSchoolUserPassword} className="user-management-reset">
                <input type="hidden" name="schoolId" value={String(context.schoolId)} />
                <input type="hidden" name="userId" value={membership.user_id} />
                <h3>Set password directly</h3>
                <label>New password<input type="password" name="password" minLength={8} maxLength={128} autoComplete="new-password" required disabled={isSelf} /></label>
                <label>Confirm password<input type="password" name="confirmPassword" minLength={8} maxLength={128} autoComplete="new-password" required disabled={isSelf} /></label>
                <button type="submit" className="dashboard-action dashboard-action--primary" disabled={isSelf}>Change password</button>
                {isSelf && <small>Use My profile to manage your account.</small>}
              </form>
            </div></AccountEditPanel>}
        </article>;
      })}
      {!memberships?.length && <p className="dashboard-muted">No user accounts are assigned to this school.</p>}
    </section>
  </main>;
}
