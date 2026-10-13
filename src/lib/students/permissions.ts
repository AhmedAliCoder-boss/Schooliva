import type { createClient } from "@/lib/supabase/server";

type StudentRoleRow = {
  roles: { slug: string } | { slug: string }[] | null;
};

export function hasStudentProfileEditRole(rows: StudentRoleRow[]) {
  return rows.some((row) => {
    const roles = Array.isArray(row.roles) ? row.roles : row.roles ? [row.roles] : [];
    return roles.some((role) => ["school_admin", "principal"].includes(role.slug));
  });
}

export async function canEditStudentProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("roles(slug)")
    .eq("user_id", userId)
    .eq("school_id", schoolId);
  if (error) throw new Error("Student profile edit permissions could not be loaded.");
  return hasStudentProfileEditRole(data ?? []);
}
