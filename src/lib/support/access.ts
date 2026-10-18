import { redirect } from "next/navigation";

import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { requireUser } from "@/lib/auth/authorization";

export async function requireSchoolSupportAccess() {
  const current = await requireUser();
  const schoolContext = await getActiveSchoolContext(current.supabase, current.user.id);
  if (!schoolContext.schoolId || schoolContext.isMasterAdmin) redirect("/admin/support");

  const { data: assignments, error } = await current.supabase
    .from("user_roles")
    .select("roles!inner(slug)")
    .eq("user_id", current.user.id)
    .eq("school_id", schoolContext.schoolId);
  if (error) {
    console.error("School support access could not be verified.", error);
    throw new Error("School support access could not be verified.");
  }

  const allowed = (assignments ?? []).some((assignment) => {
    const role = Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles;
    return role && typeof role === "object" && "slug" in role && ["school_admin", "principal"].includes(String(role.slug));
  });
  if (!allowed) redirect("/dashboard?error=not-authorized");

  return { ...current, schoolId: schoolContext.schoolId, schoolName: schoolContext.schoolName };
}
