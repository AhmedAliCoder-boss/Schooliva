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

  return <main className="profile-page">
    <header className="profile-page__heading">
      <div>
        <p className="module-page-header__eyebrow">Account settings</p>
        <h1>My profile</h1>
        <p>Manage the personal details and photo shown across your school workspace.</p>
      </div>
      <Link className="profile-page__back" href="/dashboard"><span aria-hidden="true">←</span> Back to dashboard</Link>
    </header>
    <div className="profile-page__content">
      <section className="profile-card" aria-labelledby="profile-card-title">
        <header className="profile-card__heading">
          <div>
            <span className="dashboard-panel-kicker">Personal information</span>
            <h2 id="profile-card-title">Profile details</h2>
            <p>Keep your contact information up to date.</p>
          </div>
          <span className="profile-card__secure"><span aria-hidden="true">✓</span> Visible in workspace</span>
        </header>
        <ProfileForm email={user.email ?? ""} fullName={profile?.full_name ?? ""} username={profile?.username ?? ""} phone={profile?.phone ?? ""} avatarUrl={avatar?.signedUrl ?? null} />
      </section>
      <aside className="profile-page__aside">
        <section className="profile-info-card">
          <span className="profile-info-card__icon" aria-hidden="true">i</span>
          <div>
            <h2>About your profile</h2>
            <p>Your name, username, and photo help identify you across the school workspace.</p>
          </div>
          <ul>
            <li>Your email address is managed by your school and can’t be changed here.</li>
            <li>Use a clear square photo for the best fit.</li>
          </ul>
        </section>
        {canManageUsers && activeSchoolContext.schoolId && <section className="profile-admin-card">
          <span className="dashboard-panel-kicker">Administration</span>
          <h2>Manage school accounts</h2>
          <p>Update staff profiles and roles, or send password reset links.</p>
          <Link href="/users" className="profile-admin-card__link">Open user management <span aria-hidden="true">→</span></Link>
        </section>}
        {isMasterAdmin && !activeSchoolContext.schoolId && <section className="profile-admin-card">
          <span className="dashboard-panel-kicker">Administration</span>
          <h2>Platform accounts</h2>
          <p>Manage platform user accounts and access.</p>
          <Link href="/admin/accounts" className="profile-admin-card__link">Open accounts <span aria-hidden="true">→</span></Link>
        </section>}
      </aside>
    </div>
  </main>;
}