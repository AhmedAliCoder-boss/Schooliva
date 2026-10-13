import Link from "next/link";
import Image from "next/image";

import { AdminShell } from "@/components/admin/admin-shell";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireMasterAdmin } from "@/lib/admin/guard";

type AccountMembership = {
  school_id: string;
  school_name: string;
  role_id: string;
  role_name: string;
  role_slug: string;
};

type ManagedAccount = {
  id: string;
  application_user_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_path: string | null;
  account_status: "active" | "inactive" | "suspended";
  profile_created_at: string;
  profile_updated_at: string;
  auth_created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  memberships: AccountMembership[];
  total_count: number;
};

type SearchParams = Promise<{
  q?: string;
  school?: string;
  role?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: string;
}>;

function asAccounts(value: unknown): ManagedAccount[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ManagedAccount => Boolean(item && typeof item === "object" && "id" in item));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
}

function queryUrl(params: Record<string, string>, page: number) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  search.set("page", String(page));
  return `/admin/accounts?${search.toString()}`;
}

export default async function AdminAccountsPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireMasterAdmin();
  const raw = await searchParams;
  const search = (raw.q ?? "").trim().slice(0, 100);
  const schoolId = raw.school && /^[0-9a-f-]{36}$/i.test(raw.school) ? raw.school : null;
  const roleId = raw.role && /^[0-9a-f-]{36}$/i.test(raw.role) ? raw.role : null;
  const status = ["active", "inactive", "suspended"].includes(raw.status ?? "") ? raw.status! : null;
  const fromDate = raw.from && /^\d{4}-\d{2}-\d{2}$/.test(raw.from) ? raw.from : null;
  const toDate = raw.to && /^\d{4}-\d{2}-\d{2}$/.test(raw.to) ? raw.to : null;
  const pageSize = 25;
  const page = Math.max(1, Math.min(100000, Number.parseInt(raw.page ?? "1", 10) || 1));
  const filters = {
    q: search,
    school: schoolId ?? "",
    role: roleId ?? "",
    status: status ?? "",
    from: fromDate ?? "",
    to: toDate ?? "",
  };

  const [
    { data: accountsData, error: accountsError },
    { data: summaryData, error: summaryError },
    { data: schools, error: schoolsError },
    { data: roles, error: rolesError },
  ] = await Promise.all([
    supabase.rpc("list_managed_accounts", {
      target_search: search || null,
      target_school_id: schoolId,
      target_role_id: roleId,
      target_status: status,
      target_created_from: fromDate,
      target_created_to: toDate,
      target_page: page,
      target_page_size: pageSize,
    }),
    supabase.rpc("get_account_management_summary"),
    supabase.from("schools").select("id,name").order("name"),
    supabase.from("roles").select("id,school_id,name,slug").order("name"),
  ]);

  if (accountsError || summaryError || schoolsError || rolesError) {
    return (
      <AdminShell title="Accounts" description="Master Admin account management." breadcrumbs={[{ label: "Accounts" }]}>
        <p className="auth-error">
          {accountsError?.message?.includes("list_managed_accounts")
            ? "The account-management database migration is not available yet. Apply the pending Supabase migrations and retry."
            : "Accounts could not be loaded. Refresh the page or contact support if the problem continues."}
        </p>
      </AdminShell>
    );
  }

  const accounts = asAccounts(accountsData);
  const total = Number(accounts[0]?.total_count ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const adminClient = createSupabaseAdminClient();
  const avatarResults = adminClient
    ? await Promise.all(accounts.map(async (account) => {
      if (!account.avatar_path) return { id: account.id, url: null, failed: false };
      const { data, error } = await adminClient.storage
        .from("profile-avatars")
        .createSignedUrl(account.avatar_path, 60 * 10);
      return { id: account.id, url: data?.signedUrl ?? null, failed: Boolean(error) };
    }))
    : [];
  const avatarLoadFailed = avatarResults.some((result) => result.failed);
  const avatarUrls = new Map(avatarResults.flatMap((result) => result.url ? [[result.id, result.url] as const] : []));

  const summary = summaryData && typeof summaryData === "object"
    ? summaryData as Record<string, unknown>
    : {};
  const count = (key: string) => Number(summary[key] ?? 0);

  return (
    <AdminShell
      title="Accounts"
      description="Manage application identities, Supabase Auth accounts, school memberships, roles, and security."
      breadcrumbs={[{ label: "Accounts" }]}
    >
      <section className="account-summary-grid" aria-label="Account statistics">
        <article className="account-summary-card account-summary-card--total"><span>Total accounts</span><strong>{count("total_accounts")}</strong><small>Across all schools</small></article>
        <article className="account-summary-card account-summary-card--active"><span>Active</span><strong>{count("active_accounts")}</strong><small>Can sign in</small></article>
        <article className="account-summary-card account-summary-card--inactive"><span>Inactive</span><strong>{count("inactive_accounts")}</strong><small>Access paused</small></article>
        <article className="account-summary-card account-summary-card--suspended"><span>Suspended</span><strong>{count("suspended_accounts")}</strong><small>Blocked accounts</small></article>
      </section>

      {avatarLoadFailed && <p className="auth-error">Some private profile photos could not be loaded.</p>}
      {!adminClient && <p className="auth-error">Supabase server-side admin access is not configured; authentication details and photo links are unavailable.</p>}

      <section className="admin-panel account-list-panel">
        <header className="account-directory-heading">
          <div><p className="admin-kicker">Directory</p><h2>All accounts <span>{total}</span></h2><p>Search identities, review school access, and manage account security.</p></div>
          <Link className="admin-button admin-button--primary account-create-cta" href="/admin/accounts/new"><span aria-hidden="true">+</span> Create account</Link>
        </header>
        <form method="get" className="account-filter-form">
          <label className="account-search-field"><span>Search accounts</span><input name="q" defaultValue={search} placeholder="Name, email, username or User ID" /></label>
          <label>School<select name="school" defaultValue={schoolId ?? ""}><option value="">All schools</option>{(schools ?? []).map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
          <label>Role<select name="role" defaultValue={roleId ?? ""}><option value="">All roles</option>{(roles ?? []).filter((role) => role.slug !== "super_admin" && role.slug !== "master_admin").map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
          <label>Status<select name="status" defaultValue={status ?? ""}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></label>
          <details className="account-date-filter"><summary>Created date</summary><div><label>From<input type="date" name="from" defaultValue={fromDate ?? ""} /></label><label>To<input type="date" name="to" defaultValue={toDate ?? ""} /></label></div></details>
          <button type="submit" className="admin-button account-filter-submit">Apply filters</button>
          {(search || schoolId || roleId || status || fromDate || toDate) && <Link className="account-clear-filters" href="/admin/accounts">Clear filters</Link>}
        </form>
        <div className="admin-table-wrap account-desktop-list">
          <table className="admin-table admin-account-table">
            <thead><tr>
              <th>Profile</th><th>User ID</th><th>Username</th><th>Account</th>
              <th>School</th><th>Roles</th><th>Status</th><th>Last login</th><th>Joined</th><th />
            </tr></thead>
            <tbody>
              {accounts.map((account) => {
                const memberships = Array.isArray(account.memberships) ? account.memberships : [];
                const schoolNames = [...new Set(memberships.map((membership) => membership.school_name))];
                const roleNames = [...new Set(memberships.map((membership) => membership.role_name))];
                const initial = (account.full_name ?? account.username ?? "A").trim().charAt(0).toUpperCase();
                const avatarUrl = avatarUrls.get(account.id);
                return (
                  <tr key={account.id}>
                    <td>
                      <div className="admin-account-profile">
                        {avatarUrl
                          ? <Image src={avatarUrl} alt="" width={38} height={38} unoptimized className="admin-account-avatar" />
                          : <span className="admin-account-avatar">{initial}</span>}
                      </div>
                    </td>
                    <td><span title={account.id}>{account.application_user_id}</span></td>
                    <td>{account.username ?? "-"}</td>
                    <td><strong>{account.full_name ?? "-"}</strong><small>{account.email ?? "No email"}</small></td>
                    <td>{schoolNames.join(", ") || "Unassigned"}</td>
                    <td>{roleNames.join(", ") || "Unassigned"}</td>
                    <td><span className={`admin-badge admin-badge--${account.account_status === "active" ? "positive" : "warning"}`}>{account.account_status}</span></td>
                    <td>{formatDate(account.last_sign_in_at)}</td>
                    <td>{formatDate(account.auth_created_at || account.profile_created_at)}</td>
                    <td>
                      <details className="account-row-actions">
                        <summary>Actions</summary>
                        <div>
                          <Link href={`/admin/accounts/${account.id}`}>View / edit</Link>
                          <Link href={`/admin/accounts/${account.id}#security`}>Security</Link>
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })}
              {!accounts.length && <tr><td colSpan={10}>No accounts match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="account-mobile-list">
          {accounts.map((account) => {
            const memberships = Array.isArray(account.memberships) ? account.memberships : [];
            const schoolNames = [...new Set(memberships.map((membership) => membership.school_name))];
            const roleNames = [...new Set(memberships.map((membership) => membership.role_name))];
            const initial = (account.full_name ?? account.username ?? "A").trim().charAt(0).toUpperCase();
            const avatarUrl = avatarUrls.get(account.id);
            return <article className="account-mobile-card" key={account.id}>
              <div className="account-mobile-card__top">
                {avatarUrl
                  ? <Image src={avatarUrl} alt="" width={44} height={44} unoptimized className="admin-account-avatar" />
                  : <span className="admin-account-avatar">{initial}</span>}
                <div><strong>{account.full_name ?? "Unnamed account"}</strong><span>{account.email ?? "No email on file"}</span></div>
                <span className={`admin-badge admin-badge--${account.account_status === "active" ? "positive" : "warning"}`}>{account.account_status}</span>
              </div>
              <dl><div><dt>User ID</dt><dd>{account.application_user_id}</dd></div><div><dt>Username</dt><dd>{account.username ?? "-"}</dd></div><div><dt>School</dt><dd>{schoolNames.join(", ") || "Unassigned"}</dd></div><div><dt>Role</dt><dd>{roleNames.join(", ") || "Unassigned"}</dd></div><div><dt>Last login</dt><dd>{formatDate(account.last_sign_in_at)}</dd></div></dl>
              <Link className="admin-button admin-button--primary" href={`/admin/accounts/${account.id}`}>View account <span aria-hidden="true">→</span></Link>
            </article>;
          })}
          {!accounts.length && <div className="account-empty-state"><span aria-hidden="true">⌕</span><strong>No matching accounts</strong><p>Try changing or clearing your filters.</p></div>}
        </div>
        <nav className="account-pagination" aria-label="Account pages">
          <span>Page {page} of {pageCount}</span>
          <div>
            {page > 1 && <Link className="admin-button" href={queryUrl(filters, page - 1)}>Previous</Link>}
            {page < pageCount && <Link className="admin-button" href={queryUrl(filters, page + 1)}>Next</Link>}
          </div>
        </nav>
      </section>
    </AdminShell>
  );
}
