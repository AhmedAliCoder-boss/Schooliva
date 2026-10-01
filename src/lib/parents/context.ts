import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/authorization";
import { getActiveSchoolContext } from "@/lib/admin/school-context";

export async function requireParentContext(action: "view" | "create" | "update") {
  const current = await requireUser();
  const { schoolId, isMasterAdmin } = await getActiveSchoolContext(current.supabase, current.user.id);
  if (!schoolId) redirect(isMasterAdmin ? "/admin" : "/setup?onboarding=1");
  const { data: allowed } = await current.supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "parents", target_action: action });
  if (!allowed) redirect("/dashboard?error=not-authorized");
  return { ...current, schoolId };
}