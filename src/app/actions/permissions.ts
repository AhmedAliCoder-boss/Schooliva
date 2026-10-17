"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { requireUser } from "@/lib/auth/authorization";

const overrideSchema = z.object({
  roleId: z.string().uuid(),
  permissionId: z.string().uuid(),
  granted: z.enum(["true", "false"]),
});

const roleSchema = z.object({ roleId: z.string().uuid() });
const protectedRoleSlugs = new Set(["super_admin", "master_admin", "school_admin", "principal"]);
const protectedPermissionResources = new Set(["roles", "permissions", "users"]);

async function requirePermissionManager() {
  const current = await requireUser();
  const { schoolId, isMasterAdmin } = await getActiveSchoolContext(current.supabase, current.user.id);
  if (!schoolId) redirect(isMasterAdmin ? "/admin" : "/setup?onboarding=1");

  const { data: allowed, error } = await current.supabase.rpc("has_permission", {
    target_school_id: schoolId,
    target_resource: "roles",
    target_action: "manage",
  });
  if (error) {
    console.error("Role permission administration could not be verified.", error);
    throw new Error("Role permission access could not be verified.");
  }
  if (!allowed) redirect("/dashboard?error=not-authorized");

  return { ...current, schoolId };
}

async function validateRoleForSchool(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  schoolId: string,
  roleId: string,
) {
  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id,name,slug,school_id")
    .eq("id", roleId)
    .maybeSingle();
  if (roleError) {
    console.error("Permission target role could not be loaded.", roleError);
    redirect("/setup/permissions?error=role-load-failed");
  }
  if (!role || (role.school_id && role.school_id !== schoolId) || protectedRoleSlugs.has(role.slug)) {
    redirect("/setup/permissions?error=invalid-role");
  }

  const { data: ownAssignment, error: assignmentError } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("school_id", schoolId)
    .eq("role_id", role.id)
    .maybeSingle();
  if (assignmentError) {
    console.error("Permission target role assignment could not be checked.", assignmentError);
    redirect("/setup/permissions?error=role-assignment-check-failed");
  }
  if (ownAssignment) redirect("/setup/permissions?error=cannot-edit-own-role");

  return role;
}

export async function setRolePermissionOverride(formData: FormData) {
  const { supabase, user, schoolId } = await requirePermissionManager();
  const parsed = overrideSchema.safeParse({
    roleId: formData.get("roleId"),
    permissionId: formData.get("permissionId"),
    granted: formData.get("granted"),
  });
  if (!parsed.success) redirect("/setup/permissions?error=invalid-permission-change");

  const role = await validateRoleForSchool(supabase, user.id, schoolId, parsed.data.roleId);
  const { data: permission, error: permissionError } = await supabase
    .from("permissions")
    .select("id,resource,action")
    .eq("id", parsed.data.permissionId)
    .maybeSingle();
  if (permissionError) {
    console.error("Permission target could not be loaded.", permissionError);
    redirect("/setup/permissions?error=permission-load-failed");
  }
  if (!permission || permission.resource.startsWith("admin.") || protectedPermissionResources.has(permission.resource)) {
    redirect("/setup/permissions?error=invalid-permission");
  }

  const { error } = await supabase.from("role_permission_overrides").upsert({
    school_id: schoolId,
    role_id: role.id,
    permission_id: permission.id,
    granted: parsed.data.granted === "true",
  }, { onConflict: "school_id,role_id,permission_id" });
  if (error) {
    console.error("Role permission override could not be saved.", error);
    redirect(`/setup/permissions?role=${role.id}&error=permission-save-failed`);
  }

  redirect(`/setup/permissions?role=${role.id}&success=permission-updated`);
}

export async function restoreRolePermissionDefaults(formData: FormData) {
  const { supabase, user, schoolId } = await requirePermissionManager();
  const parsed = roleSchema.safeParse({ roleId: formData.get("roleId") });
  if (!parsed.success) redirect("/setup/permissions?error=invalid-role");

  const role = await validateRoleForSchool(supabase, user.id, schoolId, parsed.data.roleId);
  const { error } = await supabase
    .from("role_permission_overrides")
    .delete()
    .eq("school_id", schoolId)
    .eq("role_id", role.id);
  if (error) {
    console.error("Role permission defaults could not be restored.", error);
    redirect(`/setup/permissions?role=${role.id}&error=permission-reset-failed`);
  }

  redirect(`/setup/permissions?role=${role.id}&success=defaults-restored`);
}
