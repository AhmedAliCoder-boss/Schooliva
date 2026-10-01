import { cookies } from "next/headers";

import { resolveSelectedSchoolId } from "@/lib/admin/school-context-policy";
import { isMasterAdminUser } from "@/lib/auth/roles";
import type { createClient } from "@/lib/supabase/server";

export const ADMIN_SCHOOL_COOKIE = "schooliva_admin_school";
export const SCHOOL_CONTEXT_COOKIE = "schooliva_selected_school";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function getActiveSchoolContext(supabase: SupabaseServerClient, userId: string) {
  const masterAdmin = await isMasterAdminUser(supabase, userId);
  const cookieStore = await cookies();

  if (masterAdmin) {
    const selectedSchoolId = cookieStore.get(ADMIN_SCHOOL_COOKIE)?.value;
    if (!selectedSchoolId) return { schoolId: null, schoolName: null, isMasterAdmin: true };

    const { data: school } = await supabase.from("schools").select("id,name").eq("id", selectedSchoolId).maybeSingle();
    if (!school) return { schoolId: null, schoolName: null, isMasterAdmin: true };
    return { schoolId: String(school.id), schoolName: String(school.name), isMasterAdmin: true };
  }

  const { data: memberships } = await supabase
    .from("user_roles")
    .select("school_id,schools(name)")
    .eq("user_id", userId)
    .order("school_id", { ascending: true });

  const membershipIds = (memberships ?? []).map((membership) => membership.school_id ? String(membership.school_id) : null);
  const selectedSchoolId = resolveSelectedSchoolId(cookieStore.get(SCHOOL_CONTEXT_COOKIE)?.value ?? null, membershipIds);

  const selectedMembership = (memberships ?? []).find((membership) => membership.school_id && String(membership.school_id) === selectedSchoolId);
  const selectedSchoolRecord = selectedMembership?.schools;
  const schoolName = Array.isArray(selectedSchoolRecord)
    ? selectedSchoolRecord[0] && typeof selectedSchoolRecord[0] === "object" && "name" in selectedSchoolRecord[0]
      ? String((selectedSchoolRecord[0] as { name?: string | null }).name ?? null)
      : null
    : selectedSchoolRecord && typeof selectedSchoolRecord === "object" && "name" in selectedSchoolRecord
      ? String((selectedSchoolRecord as { name?: string | null }).name ?? null)
      : null;

  return {
    schoolId: selectedSchoolId,
    schoolName: schoolName || null,
    isMasterAdmin: false,
    requiresExplicitSelection: membershipIds.length > 1 && !selectedSchoolId,
  };
}
