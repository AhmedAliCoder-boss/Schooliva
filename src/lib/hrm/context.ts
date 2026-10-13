import { redirect } from "next/navigation";

import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { requireUser } from "@/lib/auth/authorization";

export async function requireHrmContext(action: "view" | "manage") {
  const current = await requireUser();
  const { schoolId, isMasterAdmin } = await getActiveSchoolContext(current.supabase, current.user.id);
  if (!schoolId) redirect(isMasterAdmin ? "/admin" : "/setup?onboarding=1");
  const { data: allowed, error } = await current.supabase.rpc("has_permission", {
    target_school_id: schoolId,
    target_resource: "recruitment",
    target_action: action,
  });
  if (error) throw new Error("Recruitment permissions could not be verified.");
  if (!allowed) redirect("/dashboard?error=not-authorized");
  return { ...current, schoolId };
}
