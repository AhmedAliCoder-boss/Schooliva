import Link from "next/link";
import { redirect } from "next/navigation";

import { restoreRolePermissionDefaults, setRolePermissionOverride } from "@/app/actions/permissions";
import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { requireUser } from "@/lib/auth/authorization";

type RoleRow = { id: string; name: string; slug: string; school_id: string | null };
type PermissionRow = { id: string; resource: string; action: string; description: string | null };
type OverrideRow = { role_id: string; permission_id: string; granted: boolean };
type AuditRow = {
  id: string;
  role_name: string;
  role_slug: string;
  permission_resource: string;
  permission_action: string;
  old_granted: boolean | null;
  new_granted: boolean | null;
  actor_id: string | null;
  created_at: string;
};

const protectedRoleSlugs = new Set(["super_admin", "master_admin", "school_admin", "principal"]);
const protectedPermissionResources = new Set(["roles", "permissions", "users"]);

export default async function SchoolRolePermissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const current = await requireUser();
  const { schoolId, isMasterAdmin } = await getActiveSchoolContext(current.supabase, current.user.id);
  if (!schoolId) redirect(isMasterAdmin ? "/admin" : "/setup?onboarding=1");

  const { data: allowed, error: permissionCheckError } = await current.supabase.rpc("has_permission", {
    target_school_id: schoolId,
    target_resource: "roles",
    target_action: "manage",
  });
  if (permissionCheckError) {
    console.error("School role-permission access could not be verified.", permissionCheckError);
    throw new Error("School role-permission access could not be verified.");
  }
  if (!allowed) redirect("/dashboard?error=not-authorized");

  const [
    { data: globalRoles, error: globalRolesError },
    { data: schoolRoles, error: schoolRolesError },
    { data: allPermissions, error: permissionsError },
    { data: allOverrides, error: overridesError },
    { data: auditRows, error: auditError },
  ] = await Promise.all([
    current.supabase.from("roles").select("id,name,slug,school_id").is("school_id", null).order("name"),
    current.supabase.from("roles").select("id,name,slug,school_id").eq("school_id", schoolId).order("name"),
    current.supabase.from("permissions").select("id,resource,action,description").order("resource").order("action"),
    current.supabase.from("role_permission_overrides").select("role_id,permission_id,granted").eq("school_id", schoolId),
    current.supabase.from("role_permission_override_audit")
      .select("id,role_name,role_slug,permission_resource,permission_action,old_granted,new_granted,actor_id,created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const readError = globalRolesError ?? schoolRolesError ?? permissionsError ?? overridesError ?? auditError;
  if (readError) {
    console.error("School role-permission data could not be loaded.", readError);
    throw new Error("School role-permission data could not be loaded.");
  }

  const roles = [...(globalRoles ?? []), ...(schoolRoles ?? [])]
    .filter((role) => !protectedRoleSlugs.has(role.slug)) as RoleRow[];
  const roleId = roles.find((role) => role.id === params.role)?.id ?? roles[0]?.id;
  const selectedRole = roles.find((role) => role.id === roleId);
  const visiblePermissions = (allPermissions ?? []).filter((permission) =>
    !permission.resource.startsWith("admin.") &&
    !protectedPermissionResources.has(permission.resource)
  ) as PermissionRow[];

  const { data: defaults, error: defaultsError } = roleId
    ? await current.supabase.from("role_permissions").select("permission_id").eq("role_id", roleId)
    : { data: [], error: null };
  if (defaultsError) {
    console.error("Default role permissions could not be loaded.", defaultsError);
    throw new Error("Default role permissions could not be loaded.");
  }

  const defaultPermissionIds = new Set((defaults ?? []).map((mapping) => String(mapping.permission_id)));
  const roleOverrides = (allOverrides ?? []).filter((override) => override.role_id === roleId) as OverrideRow[];
  const overridesByPermission = new Map(roleOverrides.map((override) => [override.permission_id, override.granted]));
  const groupedPermissions = new Map<string, PermissionRow[]>();
  for (const permission of visiblePermissions) {
    const group = groupedPermissions.get(permission.resource) ?? [];
    group.push(permission);
    groupedPermissions.set(permission.resource, group);
  }

  return (
    <main className="setup-shell">
      <header className="setup-header">
        <div>
          <p className="eyebrow">School access</p>
          <h1>Role permissions</h1>
          <p className="setup-lede">School-scoped permission overrides. A denial overrides a default grant; resetting a role removes its overrides and restores the seeded permissions.</p>
        </div>
        <Link className="dashboard-action" href="/dashboard">Return to dashboard</Link>
      </header>

      {params.error && <p className="auth-error" role="alert">The requested permission change could not be completed ({params.error}).</p>}
      {params.success && <p className="auth-success" role="status">{params.success === "defaults-restored" ? "Role defaults restored." : "Permission changes saved."}</p>}

      <section className="admin-panel">
        <form method="get" className="student-form">
          <label className="student-field" htmlFor="role">Role
            <select id="role" name="role" defaultValue={selectedRole?.id}>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
          </label>
          <button className="dashboard-action dashboard-action--primary" type="submit">View role</button>
        </form>
        {selectedRole && (
          <form action={restoreRolePermissionDefaults} style={{ marginTop: 12 }}>
            <input type="hidden" name="roleId" value={selectedRole.id} />
            <button className="dashboard-action" type="submit">Restore defaults</button>
          </form>
        )}
      </section>

      {!selectedRole ? (
        <section className="empty-state"><h2>No eligible roles</h2><p>There are no school-level roles available for permission configuration.</p></section>
      ) : (
        <section className="admin-panel admin-panel--flush">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Module</th><th>Action</th><th>Default</th><th>Effective access</th><th>Change</th></tr></thead>
              <tbody>
                {[...groupedPermissions.entries()].flatMap(([resource, permissions]) =>
                  permissions.map((permission) => {
                    const defaultGranted = defaultPermissionIds.has(permission.id);
                    const override = overridesByPermission.get(permission.id);
                    const effectiveGranted = override ?? defaultGranted;
                    return (
                      <tr key={permission.id}>
                        <td><strong>{resource}</strong><small>{permission.description ?? "No description"}</small></td>
                        <td>{permission.action}</td>
                        <td>{defaultGranted ? "Granted" : "Not granted"}</td>
                        <td>{effectiveGranted ? "Granted" : "Denied"}</td>
                        <td>
                          <form action={setRolePermissionOverride}>
                            <input type="hidden" name="roleId" value={selectedRole.id} />
                            <input type="hidden" name="permissionId" value={permission.id} />
                            <input type="hidden" name="granted" value={String(!effectiveGranted)} />
                            <button className="admin-badge admin-badge--neutral" type="submit">
                              {effectiveGranted ? "Revoke" : "Grant"}
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="admin-panel">
        <div className="admin-panel__heading"><div><p className="admin-kicker">Permission history</p><h2>Recent changes</h2></div></div>
        {(auditRows as AuditRow[] | null)?.length ? (
          <div className="admin-health-list">
            {(auditRows as AuditRow[]).map((entry) => (
              <div className="admin-health-row" key={entry.id}>
                <strong>{entry.role_name} · {entry.permission_resource}:{entry.permission_action}</strong>
                <span>{entry.new_granted === null ? "Restored default" : entry.new_granted ? "Granted" : "Revoked"}</span>
                <small>{entry.actor_id ? `Actor ${entry.actor_id}` : "System"} · {new Date(entry.created_at).toLocaleString()}</small>
              </div>
            ))}
          </div>
        ) : <p className="dashboard-muted">No permission changes have been recorded for this school.</p>}
      </section>
    </main>
  );
}
