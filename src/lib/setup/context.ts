import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/authorization";
import { getActiveSchoolContext } from "@/lib/admin/school-context";

export async function requireSetupContext() {
  const current = await requireUser();
  const { schoolId, isMasterAdmin } = await getActiveSchoolContext(current.supabase, current.user.id);
  if (!schoolId) redirect(isMasterAdmin ? "/admin" : "/setup?onboarding=1");
  const { data: allowed } = await current.supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "school_setup", target_action: "manage" });
  if (!allowed) redirect("/dashboard?error=not-authorized");
  return { ...current, schoolId };
}