import { redirect } from "next/navigation";

import { isAdminAccountManagerRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export type Permission = { resource: string; action: string };

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { supabase, user };
}

export async function requireUser() {
  const current = await getCurrentUser();
  if (!current) redirect("/sign-in");
  return current;
}

export async function hasPermission(schoolId: string, permission: Permission) {
  const current = await getCurrentUser();
  if (!current) return false;
  const { data, error } = await current.supabase.rpc("has_permission", {
    target_school_id: schoolId,
    target_resource: permission.resource,
    target_action: permission.action,
  });
  return !error && data === true;
}

export async function requirePermission(schoolId: string, permission: Permission) {
  const allowed = await hasPermission(schoolId, permission);
  if (!allowed) redirect("/dashboard?error=not-authorized");
}

export async function canManageUserAccounts() {
  const current = await getCurrentUser();
  if (!current) return false;

  const { data, error } = await current.supabase
    .from("user_roles")
    .select("roles!inner(slug)")
    .eq("user_id", current.user.id);

  if (error || !data) return false;

  return data.some((row) => {
    const roles = Array.isArray((row as { roles?: unknown }).roles)
      ? (row as { roles?: Array<{ slug?: string | null }> }).roles ?? []
      : [(row as { roles?: { slug?: string | null } | null }).roles].filter(Boolean);

    return roles.some((role) => isAdminAccountManagerRole(role?.slug ?? null));
  });
}