import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/authorization";

export async function requirePeopleAttendanceContext(action: "view" | "manage") {
  const current = await requireUser();
  const { data: membership } = await current.supabase.from("user_roles").select("school_id").eq("user_id", current.user.id).limit(1).maybeSingle();
  if (!membership?.school_id) redirect("/setup?onboarding=1");
  const [{ data: canManageTeachers }, { data: canManageStaff }] = await Promise.all([
    current.supabase.rpc("has_permission", { target_school_id: membership.school_id, target_resource: "teachers", target_action: action }),
    current.supabase.rpc("has_permission", { target_school_id: membership.school_id, target_resource: "staff", target_action: action }),
  ]);
  if (!canManageTeachers && !canManageStaff) redirect("/dashboard?error=not-authorized");
  return { ...current, schoolId: membership.school_id as string };
}