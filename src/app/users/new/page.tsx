import Link from "next/link";

import { AccountCreateForm } from "@/components/admin/account-create-form";
import { requireSchoolAccountManager } from "@/lib/admin/school-account-context";
import { SCHOOL_MANAGED_ACCOUNT_ROLE_SLUGS } from "@/lib/auth/roles";

export default async function NewSchoolUserPage() {
  const { supabase, schoolId, schoolName } = await requireSchoolAccountManager();
  const [{ data: school, error: schoolError }, { data: roles, error: rolesError }] = await Promise.all([
    supabase.from("schools").select("id,name").eq("id", schoolId).maybeSingle(),
    supabase.from("roles").select("id,school_id,name,slug")
      .or(`school_id.is.null,school_id.eq.${schoolId}`)
      .order("name"),
  ]);
  if (schoolError || rolesError) {
    return <main className="user-management-page"><p className="auth-error">School accounts and roles could not be loaded. Refresh and try again.</p></main>;
  }
  if (!school) {
    return <main className="user-management-page"><p className="auth-error">The selected school could not be found.</p></main>;
  }

  const visibleRoles = (roles ?? []).filter((role) =>
    SCHOOL_MANAGED_ACCOUNT_ROLE_SLUGS.includes(role.slug as (typeof SCHOOL_MANAGED_ACCOUNT_ROLE_SLUGS)[number])
  );
  return <main className="user-management-page">
    <header className="page-header">
      <div><p className="page-header__eyebrow">Administration / {school.name || schoolName}</p><h1>Create school account</h1><p>Add a lower-level account only to this school.</p></div>
      <Link className="admin-button" href="/users">Back to school accounts</Link>
    </header>
    {!visibleRoles.length
      ? <p className="auth-error">No school-assignable roles are available.</p>
      : <AccountCreateForm schools={[school]} roles={visibleRoles} defaultSchoolId={schoolId} schoolLocked />}
  </main>;
}
