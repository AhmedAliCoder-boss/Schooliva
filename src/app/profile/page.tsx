import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/auth/profile-form";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle();

  return <main className="dashboard-shell"><header className="dashboard-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/dashboard">Back to dashboard -&gt;</Link></header>
    <section className="profile-section"><p className="eyebrow">Account profile</p><h1>Your profile.</h1><p className="auth-intro">Keep your contact details up to date.</p>
      <ProfileForm email={user.email ?? ""} fullName={profile?.full_name ?? ""} phone={profile?.phone ?? ""} />
    </section>
  </main>;
}