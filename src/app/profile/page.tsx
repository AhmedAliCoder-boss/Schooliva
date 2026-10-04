import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/auth/profile-form";
import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { isMasterAdminUser } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const [{ data: profile }, activeSchoolContext, isMasterAdmin] = await Promise.all([
    supabase.from("profiles").select("full_name, username, phone, avatar_path").eq("id", user.id).maybeSingle(),
    getActiveSchoolContext(supabase, user.id),
    isMasterAdminUser(supabase, user.id),
  ]);
  const { data: avatar } = profile?.avatar_path
    ? await supabase.storage.from("profile-avatars").createSignedUrl(profile.avatar_path, 60 * 60)
    : { data: null };
  const { data: canManageUsers } = activeSchoolContext.schoolId && !isMasterAdmin
    ? await supabase.rpc("has_permission", { target_school_id: activeSchoolContext.schoolId, target_resource: "users", target_action: "manage" })
    : { data: isMasterAdmin && Boolean(activeSchoolContext.schoolId) };

  return <main className="dashboard-shell profile-page">
    <header className="dashboard-header"><Link className="wordmark" href="/dashboard"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/dashboard">Back to dashboard -&gt;</Link></header>
    <section className="profile-section"><p className="eyebrow">Account profile</p><h1>Your profile.</h1><p className="auth-intro">Update your name, username, contact details, and profile photo.</p>
      <ProfileForm email={user.email ?? ""} fullName={profile?.full_name ?? ""} username={profile?.username ?? ""} phone={profile?.phone ?? ""} avatarUrl={avatar?.signedUrl ?? null} />
    </section>
    {canManageUsers && activeSchoolContext.schoolId && <section className="dashboard-panel profile-admin-link"><div className="dashboard-card-heading"><div><span className="dashboard-panel-kicker">Administration</span><h2>Manage school accounts</h2></div><Link href="/users" className="dashboard-action dashboard-action--primary">Open user management <span>-&gt;</span></Link></div><p className="dashboard-muted">Update school user profiles and roles, or send password reset links.</p></section>}
    {isMasterAdmin && !activeSchoolContext.schoolId && <section className="dashboard-panel profile-admin-link"><div className="dashboard-card-heading"><div><span className="dashboard-panel-kicker">Administration</span><h2>Platform accounts</h2></div><Link href="/admin/accounts" className="dashboard-action dashboard-action--primary">Open accounts <span>-&gt;</span></Link></div></section>}
  </main>;
}