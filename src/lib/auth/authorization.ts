import { redirect } from "next/navigation";

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