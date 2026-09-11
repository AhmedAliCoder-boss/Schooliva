import Link from "next/link";
import { redirect } from "next/navigation";

import { requirePermission, requireUser } from "@/lib/auth/authorization";

export default async function RolesPage() {
  const { supabase, user } = await requireUser();
  const { data: membership } = await supabase.from("user_roles").select("school_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership?.school_id) redirect("/dashboard?error=no-school");

  await requirePermission(membership.school_id, { resource: "roles", action: "manage" });

  return <main className="dashboard-shell"><header className="dashboard-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/dashboard">Back to dashboard -&gt;</Link></header>
    <section className="profile-section"><p className="eyebrow">Access control</p><h1>Roles & permissions.</h1><p className="auth-intro">You are authorized to manage role assignments for this school. The management surface will be expanded in the RBAC administration workflow.</p></section>
  </main>;
}