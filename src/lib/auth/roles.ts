import { createClient } from "@/lib/supabase/server";

export const MASTER_ADMIN_ROLE_SLUGS = ["super_admin"] as const;
export const ADMIN_ACCOUNT_MANAGEMENT_ROLES = ["super_admin", "school_admin", "principal"] as const;
export const SCHOOL_STAFF_ROLE_SLUGS = [
  "school_admin",
  "principal",
  "teacher",
  "accountant",
  "hr_manager",
  "hr_staff_manager",
  "librarian",
  "transport_manager",
  "cafeteria_manager",
  "staff",
] as const;
export const SCHOOL_MANAGED_ACCOUNT_ROLE_SLUGS = [
  "teacher",
  "accountant",
  "hr_manager",
  "librarian",
  "transport_manager",
  "cafeteria_manager",
  "staff",
] as const;

export const SCHOOL_DASHBOARD_ROLE_SLUGS = [
  "super_admin",
  "school_admin",
  "principal",
  "teacher",
  "student",
  "parent",
  "accountant",
  "librarian",
  "transport_manager",
  "hr_manager",
  "hr_staff_manager",
] as const;

export function normalizeSchoolRoleSlug(roleSlug: string | null | undefined): string | null {
  const normalized = roleSlug?.trim().toLowerCase();
  if (!normalized) return null;
  return normalized === "hr_staff_manager" ? "hr_manager" : normalized;
}

export function isMasterAdminRole(roleSlug: string | null | undefined): boolean {
  if (!roleSlug) return false;
  return MASTER_ADMIN_ROLE_SLUGS.includes(String(roleSlug).trim().toLowerCase() as (typeof MASTER_ADMIN_ROLE_SLUGS)[number]);
}

export function isAdminAccountManagerRole(roleSlug: string | null | undefined): boolean {
  if (!roleSlug) return false;
  return ADMIN_ACCOUNT_MANAGEMENT_ROLES.includes(String(roleSlug).trim().toLowerCase() as (typeof ADMIN_ACCOUNT_MANAGEMENT_ROLES)[number]);
}

export function isSchoolAdminRole(roleSlug: string | null | undefined): boolean {
  return roleSlug?.trim().toLowerCase() === "school_admin";
}

export function isSchoolStaffRole(roleSlug: string | null | undefined): boolean {
  if (!roleSlug) return false;
  return SCHOOL_STAFF_ROLE_SLUGS.includes(String(roleSlug).trim().toLowerCase() as (typeof SCHOOL_STAFF_ROLE_SLUGS)[number]);
}

export async function isMasterAdminUser(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  if (!userId) return false;

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || user?.id !== userId) return false;

  const { data, error } = await supabase.rpc("is_super_admin");
  return !error && data === true;
}

export async function isSchoolAdminUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  schoolId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("roles!inner(slug)")
    .eq("user_id", userId)
    .eq("school_id", schoolId);

  if (error) throw new Error("School administrator access could not be verified.");

  return (data ?? []).some((assignment) => {
    const role = Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles;
    return role && typeof role === "object" && "slug" in role && isSchoolAdminRole(String(role.slug));
  });
}
