import { redirect } from "next/navigation";

import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { isSchoolAdminRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export async function requireSchoolAccountManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const context = await getActiveSchoolContext(supabase, user.id);
  if (context.isMasterAdmin) redirect("/admin/accounts");
  if (!context.schoolId) redirect("/dashboard?error=school-required");

  const [{ data: roles, error: rolesError }, { data: allowed, error: permissionError }] = await Promise.all([
    supabase.from("user_roles").select("roles!inner(slug)")
      .eq("user_id", user.id).eq("school_id", context.schoolId),
    supabase.rpc("has_permission", {
      target_school_id: context.schoolId,
      target_resource: "users",
      target_action: "manage",
    }),
  ]);
  const isSchoolAdmin = (roles ?? []).some((membership) => {
    const value = membership.roles;
    const assignedRoles = Array.isArray(value) ? value : [value];
    return assignedRoles.some((role) =>
      role && typeof role === "object" && "slug" in role && isSchoolAdminRole(String(role.slug))
    );
  });
  if (rolesError || permissionError || allowed !== true || !isSchoolAdmin) {
    redirect("/dashboard?error=not-authorized");
  }

  return { supabase, user, schoolId: context.schoolId, schoolName: context.schoolName ?? "School" };
}
