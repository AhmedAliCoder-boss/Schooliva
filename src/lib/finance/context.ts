import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/authorization";
import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { createClient } from "@/lib/supabase/server";

export async function canManageFinance(supabase: Awaited<ReturnType<typeof createClient>>, schoolId: string, resource: "fees" | "finance" = "fees") {
  const { data, error } = await supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: resource, target_action: "manage" });
  if (error) throw new Error("Finance permissions could not be verified.");
  return Boolean(data);
}

export async function hasFinanceView(supabase: Awaited<ReturnType<typeof createClient>>, schoolId: string, resource: "fees" | "finance" = "fees") {
  const { data, error } = await supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: resource, target_action: "view" });
  if (error) throw new Error("Finance permissions could not be verified.");
  return Boolean(data);
}

export async function requireFinanceContext(action: "view" | "manage", resource: "fees" | "finance" = "fees") {
  const current = await requireUser();
  const { schoolId, isMasterAdmin } = await getActiveSchoolContext(current.supabase, current.user.id);
  if (!schoolId) redirect(isMasterAdmin ? "/admin" : "/setup?onboarding=1");
  const { data: allowed } = await current.supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: resource, target_action: action });
  if (!allowed) redirect("/dashboard?error=not-authorized");
  return { ...current, schoolId };
}
