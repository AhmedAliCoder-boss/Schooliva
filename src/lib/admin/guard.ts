import { redirect } from "next/navigation";

import { isMasterAdminUser } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export async function requireMasterAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!(await isMasterAdminUser(supabase, user.id))) redirect("/dashboard?error=not-authorized");
  return { supabase, user };
}
