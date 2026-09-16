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
  const { data: summary } = membership?.school_id ? await supabase.rpc("dashboard_summary", { target_school_id: membership.school_id }) : { data: null };
  const metrics = (summary ?? {}) as Record<string, unknown>;
  const roleSlug = String(metrics.role ?? role?.name ?? "member").toLowerCase().replaceAll(" ", "_");
  const metricCards = roleSlug === "accountant" ? [
    ["Collection today", metrics.collection_today ?? 0, "finance"],
    ["Outstanding fees", metrics.outstanding_fees ?? 0, "finance"],
    ["Overdue invoices", metrics.overdue_invoices ?? 0, "finance"],
    ["Payments today", metrics.payments_today ?? 0, "finance"],
  ] : roleSlug === "teacher" ? [
    ["Assigned classes", metrics.assigned_classes ?? 0, "teachers"],
    ["Today timetable", metrics.today_timetable ?? 0, "timetable"],
    ["Open assignments", metrics.assignments ?? 0, "assignments"],
    ["Upcoming exams", metrics.upcoming_exams ?? 0, "exams"],
  ] : roleSlug === "parent" ? [
    ["Children", metrics.children ?? 0, "parent"],
    ["Child absences / 30d", metrics.children_absence_last_30 ?? 0, "attendance"],
    ["Open assignments", metrics.unread_assignments ?? 0, "assignments"],
    ["Notifications", metrics.unread_notifications ?? 0, "notifications"],
  ] : roleSlug === "student" ? [
    ["Today timetable", metrics.today_timetable ?? 0, "timetable"],
    ["Open assignments", metrics.open_assignments ?? 0, "assignments"],
    ["Notifications", metrics.unread_notifications ?? 0, "notifications"],
  ] : [
    ["Students", metrics.students ?? 0, "students"],
    ["Teachers", metrics.teachers ?? 0, "teachers"],
    ["Staff", metrics.staff ?? 0, "staff"],
    ["Classes", metrics.classes ?? 0, "setup"],
    ["Attendance / 30d", `${metrics.attendance_percentage ?? 0}%`, "attendance"],
    ["Fee collection today", metrics.fee_collection_today ?? 0, "finance"],
    ["Outstanding fees", metrics.outstanding_fees ?? 0, "finance"],
    ["Unread notifications", metrics.unread_notifications ?? 0, "notifications"],
  ];

  return <main className="dashboard-shell"><header className="dashboard-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><form action={signOut}><button className="sign-out" type="submit">Sign out</button></form></header>
    <section className="dashboard-welcome"><p className="eyebrow">Your school workspace</p><h1>Good to see you, {profile?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there"}.</h1><p>Schooliva foundation is ready for your school operations.</p></section>
    {membership && school ? <section className="workspace-summary"><span className="principle-number">CURRENT SCHOOL</span><h2>{school.name}</h2><p>{role?.name ?? "School member"}</p></section> : <section className="empty-state"><h2>Access is pending.</h2><p>Your account is active, but it has not been connected to a school yet. Ask an administrator to add your school membership.</p></section>}
    {membership?.school_id && <section className="dashboard-metrics" aria-label="Dashboard summary">{metricCards.map(([label, value, href]) => <Link className="dashboard-metric-card" href={`/${href}`} key={String(label)}><span>{String(label)}</span><strong>{String(value)}</strong><small>Open module -&gt;</small></Link>)}</section>}
    <nav className="dashboard-links" aria-label="Account navigation"><Link href="/search">Search <span>-&gt;</span></Link><Link href="/reports">Reports <span>-&gt;</span></Link><Link href="/students">Students <span>-&gt;</span></Link><Link href="/teachers">Teachers <span>-&gt;</span></Link><Link href="/staff">Staff <span>-&gt;</span></Link><Link href="/parents">Parents <span>-&gt;</span></Link><Link href="/attendance">Attendance <span>-&gt;</span></Link><Link href="/timetable">Timetable <span>-&gt;</span></Link><Link href="/curriculum">Curriculum <span>-&gt;</span></Link><Link href="/exams">Exams <span>-&gt;</span></Link><Link href="/results">Results <span>-&gt;</span></Link><Link href="/finance">Finance <span>-&gt;</span></Link><Link href="/assignments">Assignments <span>-&gt;</span></Link><Link href="/library">Library <span>-&gt;</span></Link><Link href="/transport">Transport <span>-&gt;</span></Link><Link href="/inventory">Inventory <span>-&gt;</span></Link><Link href="/leave">Leave <span>-&gt;</span></Link><Link href="/notifications">Notifications <span>-&gt;</span></Link><Link href="/documents">Documents <span>-&gt;</span></Link><Link href="/audit">Audit log <span>-&gt;</span></Link><Link href="/setup">School setup <span>-&gt;</span></Link><Link href="/profile">Manage your profile <span>-&gt;</span></Link></nav>
  </main>;
}