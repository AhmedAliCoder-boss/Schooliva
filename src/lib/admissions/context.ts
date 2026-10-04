import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/authorization";
import { getActiveSchoolContext } from "@/lib/admin/school-context";

export type AdmissionAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "review"
  | "approve"
  | "reject"
  | "manage_documents"
  | "manage_tests"
  | "manage_interviews"
  | "manage_settings";

export async function requireAdmissionContext(action: AdmissionAction | AdmissionAction[]) {
  const current = await requireUser();
  const { schoolId, isMasterAdmin } = await getActiveSchoolContext(current.supabase, current.user.id);
  if (!schoolId) redirect(isMasterAdmin ? "/admin" : "/setup?onboarding=1");

  const actions = Array.isArray(action) ? action : [action];
  const permissionResults = await Promise.all(actions.map((targetAction) => current.supabase.rpc("has_permission", {
    target_school_id: schoolId,
    target_resource: "admissions",
    target_action: targetAction,
  })));
  if (permissionResults.some(({ error }) => error)) redirect("/dashboard?error=permission-check-failed");
  if (!permissionResults.some(({ data: allowed }) => allowed)) redirect("/dashboard?error=not-authorized");

  return { ...current, schoolId };
}
