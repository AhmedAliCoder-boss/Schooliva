import { assignPermissionToRole, removePermissionFromRole } from "@/app/actions/admin";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireMasterAdmin } from "@/lib/admin/guard";

export default async function AdminRolesPage() {
  const { supabase } = await requireMasterAdmin();
  const [{ data: roles }, { data: permissions }, { data: mappings }] = await Promise.all([
    supabase.from("roles").select("id,name,slug,description,school_id,schools(name)").order("name", { ascending: true }),
    supabase.from("permissions").select("id,resource,action,description").order("resource", { ascending: true }).order("action", { ascending: true }),
    supabase.from("role_permissions").select("role_id,permission_id"),
  ]);

  const permissionMap = new Map((permissions ?? []).map((permission) => [String(permission.id), permission]));
  const rolePermissionMap = new Map<string, string[]>();
  for (const mapping of mappings ?? []) {
    const list = rolePermissionMap.get(String(mapping.role_id)) ?? [];
    list.push(String(mapping.permission_id));
    rolePermissionMap.set(String(mapping.role_id), list);
  }

  return <AdminShell title="Platform access control" description="Master Admin authority uses the seeded role matrix and permission graph already enforced by the database." breadcrumbs={[{ label: "Platform access control" }]}>
    <section className="admin-panel">
      <div className="admin-panel__heading">
        <div><p className="admin-kicker">Grant access</p><h2>Assign a permission to a role</h2></div>
      </div>
      <form action={assignPermissionToRole} className="student-form" style={{ marginTop: 12 }}>
        <div className="student-form-grid">
          <label className="student-field">Role<select name="roleId" required>{(roles ?? []).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
          <label className="student-field">Permission<select name="permissionId" required>{(permissions ?? []).map((permission) => <option key={permission.id} value={permission.id}>{permission.resource}:{permission.action}</option>)}</select></label>
        </div>
        <button type="submit" className="dashboard-action dashboard-action--primary">Assign permission</button>
      </form>
    </section>

    <section className="admin-panel admin-panel--flush">
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Scope</th>
              <th>Permissions</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {(roles ?? []).map((role) => {
              const schoolName = Array.isArray((role as any).schools)
                ? (role as any).schools[0]?.name
                : (role as any).schools?.name;
              const permissionNames = (rolePermissionMap.get(String(role.id)) ?? []).map((permissionId) => {
                const permission = permissionMap.get(permissionId);
                return permission ? `${permission.resource}:${permission.action}` : "unknown";
              });
              return (
                <tr key={role.id}>
                  <td><strong>{role.name}</strong><small>{role.slug}</small></td>
                  <td>{role.school_id ? `School · ${schoolName ?? "Tenant"}` : "Platform"}</td>
                  <td>
                    <div className="admin-health-list" style={{ gap: 6 }}>
                      {permissionNames.length ? permissionNames.map((permissionName) => (
                        <form key={`${role.id}-${permissionName}`} action={removePermissionFromRole} style={{ display: "inline-flex", marginRight: 6 }}>
                          <input type="hidden" name="roleId" value={role.id} />
                          <input type="hidden" name="permissionId" value={(permissions ?? []).find((permission) => `${permission.resource}:${permission.action}` === permissionName)?.id ?? ""} />
                          <button type="submit" className="admin-badge admin-badge--neutral" style={{ border: "none", cursor: "pointer" }}>{permissionName}</button>
                        </form>
                      )) : <span className="admin-note">No explicit permissions</span>}
                    </div>
                  </td>
                  <td>{role.description ?? "No description"}</td>
                </tr>
              );
            })}
            {!roles?.length && <tr><td colSpan={4}>No roles are available.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </AdminShell>;
}
