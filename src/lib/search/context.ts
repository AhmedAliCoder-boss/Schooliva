import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/authorization";

export async function requireSearchContext() {
  const current = await requireUser();
  const { data: membership } = await current.supabase.from("user_roles").select("school_id").eq("user_id", current.user.id).limit(1).maybeSingle();
  if (!membership?.school_id) redirect("/setup?onboarding=1");
  return { ...current, schoolId: membership.school_id as string };
}
