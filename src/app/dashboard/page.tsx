import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const { data: membership } = await supabase.from("user_roles").select("school_id, roles(name), schools(name)").eq("user_id", user.id).limit(1).maybeSingle();
  const school = Array.isArray(membership?.schools) ? membership.schools[0] : membership?.schools;
  const role = Array.isArray(membership?.roles) ? membership.roles[0] : membership?.roles;

  return <main className="dashboard-shell"><header className="dashboard-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><form action={signOut}><button className="sign-out" type="submit">Sign out</button></form></header>
    <section className="dashboard-welcome"><p className="eyebrow">Your school workspace</p><h1>Good to see you, {profile?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there"}.</h1><p>Schooliva foundation is ready for your school operations.</p></section>
    {membership && school ? <section className="workspace-summary"><span className="principle-number">CURRENT SCHOOL</span><h2>{school.name}</h2><p>{role?.name ?? "School member"}</p></section> : <section className="empty-state"><h2>Access is pending.</h2><p>Your account is active, but it has not been connected to a school yet. Ask an administrator to add your school membership.</p></section>}
    <nav className="dashboard-links" aria-label="Account navigation"><Link href="/students">Students <span>-&gt;</span></Link><Link href="/teachers">Teachers <span>-&gt;</span></Link><Link href="/staff">Staff <span>-&gt;</span></Link><Link href="/parents">Parents <span>-&gt;</span></Link><Link href="/attendance">Attendance <span>-&gt;</span></Link><Link href="/timetable">Timetable <span>-&gt;</span></Link><Link href="/curriculum">Curriculum <span>-&gt;</span></Link><Link href="/exams">Exams <span>-&gt;</span></Link><Link href="/results">Results <span>-&gt;</span></Link><Link href="/finance">Finance <span>-&gt;</span></Link><Link href="/assignments">Assignments <span>-&gt;</span></Link><Link href="/library">Library <span>-&gt;</span></Link><Link href="/transport">Transport <span>-&gt;</span></Link><Link href="/inventory">Inventory <span>-&gt;</span></Link><Link href="/leave">Leave <span>-&gt;</span></Link><Link href="/notifications">Notifications <span>-&gt;</span></Link><Link href="/setup">School setup <span>-&gt;</span></Link><Link href="/profile">Manage your profile <span>-&gt;</span></Link></nav>
  </main>;
}