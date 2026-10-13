import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountCreateForm } from "@/components/admin/account-create-form";
import { AdminShell } from "@/components/admin/admin-shell";
import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { isMasterAdminUser } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export default async function NewAdminAccountPage({ searchParams }: { searchParams: Promise<{ school?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const isMasterAdmin = await isMasterAdminUser(supabase, user.id);
  const context = await getActiveSchoolContext(supabase, user.id);
  const params = await searchParams;
  const accountsHref = isMasterAdmin ? "/admin/accounts" : "/users";
  const schoolId = isMasterAdmin ? params.school ?? null : context.schoolId;
  if (!isMasterAdmin && !schoolId) redirect("/dashboard?error=school-required");
  if (!isMasterAdmin) {
    const [{ data: allowed, error: permissionError }, { data: memberships, error: membershipsError }] = await Promise.all([
      supabase.rpc("has_permission", {
        target_school_id: schoolId,
        target_resource: "users",
        target_action: "manage",
      }),
      supabase.from("user_roles").select("roles!inner(slug)")
        .eq("user_id", user.id).eq("school_id", schoolId),
    ]);
    const isSchoolAdmin = (memberships ?? []).some((membership) => {
      const value = (membership as { roles?: unknown }).roles;
      const roles = Array.isArray(value) ? value : [value];
      return roles.some((role) => role && typeof role === "object" && "slug" in role && role.slug === "school_admin");
    });
    if (permissionError || membershipsError || allowed !== true || !isSchoolAdmin) {
      redirect("/dashboard?error=not-authorized");
    }
    redirect("/users/new");
  }

  const [{ data: schools, error: schoolsError }, { data: roles, error: rolesError }] = await Promise.all([
    (() => {
      const query = supabase.from("schools").select("id,name").order("name");
      return schoolId ? query.eq("id", schoolId) : query;
    })(),
    (() => {
      const query = supabase.from("roles").select("id,school_id,name,slug").order("name");
      return schoolId ? query.or(`school_id.is.null,school_id.eq.${schoolId}`) : query;
    })(),
  ]);

  if (schoolsError || rolesError) {
    return (
      <AdminShell title="Create user" description="Add an account to Schooliva." breadcrumbs={[{ label: "Accounts", href: accountsHref }, { label: "Create user" }]}>
        <p className="auth-error">Schools and roles could not be loaded. Refresh the page and try again.</p>
      </AdminShell>
    );
  }

  const defaultSchoolId = schools?.some((school) => school.id === schoolId) ? schoolId ?? undefined : undefined;
  const visibleRoles = isMasterAdmin
    ? roles ?? []
    : (roles ?? []).filter((role) => ["teacher", "accountant", "hr_manager", "librarian", "transport_manager", "staff"].includes(role.slug));

  return (
    <AdminShell title="Create user" description="Create a Supabase Auth account, application profile, and school membership together." breadcrumbs={[{ label: "Accounts", href: accountsHref }, { label: "Create user" }]}>
      <section className="admin-panel account-editor-panel">
        <header className="admin-panel__heading">
          <div><p className="admin-kicker">New account</p><h2>Account details</h2></div>
          <Link className="admin-button" href={accountsHref}>Back to accounts</Link>
        </header>
        {!schools?.length
          ? <p className="auth-error">Create a school before creating a school account.</p>
          : <AccountCreateForm schools={schools} roles={visibleRoles} defaultSchoolId={defaultSchoolId} />}
      </section>
    </AdminShell>
  );
}
