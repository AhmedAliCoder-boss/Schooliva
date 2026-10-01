export const MASTER_ADMIN_ROLE_SLUGS = ["super_admin", "master_admin"] as const;
export const ADMIN_ACCOUNT_MANAGEMENT_ROLES = ["super_admin", "master_admin", "school_admin", "principal"] as const;

export function isMasterAdminRole(roleSlug: string | null | undefined): boolean {
  if (!roleSlug) return false;
  return MASTER_ADMIN_ROLE_SLUGS.includes(String(roleSlug).trim().toLowerCase() as (typeof MASTER_ADMIN_ROLE_SLUGS)[number]);
}

export function isAdminAccountManagerRole(roleSlug: string | null | undefined): boolean {
  if (!roleSlug) return false;
  return ADMIN_ACCOUNT_MANAGEMENT_ROLES.includes(String(roleSlug).trim().toLowerCase() as (typeof ADMIN_ACCOUNT_MANAGEMENT_ROLES)[number]);
}

import { createClient } from "@/lib/supabase/server";

export async function isMasterAdminUser(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  void userId;
  const { data, error } = await supabase.rpc("is_super_admin");
  return !error && data === true;
}
