import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/actions/auth";
import { LiveGreeting } from "@/components/dashboard/live-greeting";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format/currency";
import { SchoolivaShell } from "@/components/schooliva-shell";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const { data: membership } = await supabase.from("user_roles").select("school_id, roles(name), schools(name)").eq("user_id", user.id).limit(1).maybeSingle();
  const school = Array.isArray(membership?.schools) ? membership.schools[0] : membership?.schools;
  const role = Array.isArray(membership?.roles) ? membership.roles[0] : membership?.roles;
  const { data: summary } = membership?.school_id ? await supabase.rpc("dashboard_summary", { target_school_id: membership.school_id }) : { data: null };
  const { data: trendData } = membership?.school_id ? await supabase.rpc("dashboard_trends", { target_school_id: membership.school_id }) : { data: null };
  const metrics = (summary ?? {}) as Record<string, unknown>;
  const trends = (trendData ?? {}) as { attendance?: Array<{ date: string; value: number }>; payments?: Array<{ date: string; value: number }>; schools_count?: number };
  const roleSlug = String(metrics.role ?? role?.name ?? "member").toLowerCase().replaceAll(" ", "_");
  const metricCards = roleSlug === "accountant" ? [
    ["Collection today", metrics.collection_today ?? 0, "finance"],
    ["Outstanding fees", formatCurrency(metrics.outstanding_fees), "finance"],
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
    ["Fee collection today", formatCurrency(metrics.fee_collection_today), "finance"],
    ["Outstanding fees", formatCurrency(metrics.outstanding_fees), "finance"],
    ["Unread notifications", metrics.unread_notifications ?? 0, "notifications"],
  ];
  const firstName = profile?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there";
  const roleLabel = roleSlug.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const attendance = trends.attendance ?? [];
  const payments = trends.payments ?? [];
  const maxPayment = Math.max(...payments.map((item) => Number(item.value)), 1);
  const pointFor = (value: number, index: number, values: Array<{ value: number }>) => {
    const width = 620;
    const height = 190;
    const x = values.length > 1 ? (index / (values.length - 1)) * width : width / 2;
    const y = height - (value / Math.max(...values.map((item) => Number(item.value)), 1)) * 155;
    return `${x},${Math.max(10, y)}`;
  };
  const activity = Array.isArray(metrics.recent_activity) ? metrics.recent_activity as Array<{ entity_type?: string; action?: string; created_at?: string }> : [];
  const lastSignIn = user.last_sign_in_at ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(user.last_sign_in_at)) : "Not available";

  return (
    <SchoolivaShell
      title="Dashboard"
      description="Schooliva is ready to support your school operations with a clearer, faster view of what matters."
      breadcrumbs={[{ label: "Dashboard" }]}
      actions={<form action={signOut}><button className="sign-out" type="submit">Sign out</button></form>}
      headerVariant="dashboard"
      userName={profile?.full_name ?? user.email ?? "Schooliva user"}
      userRole={roleLabel}
      unreadNotifications={Number(metrics.unread_notifications ?? 0)}
    >
      <section className="dashboard-welcome"><div><p className="dashboard-kicker">{school?.name ?? "School workspace"} / {roleLabel}</p><LiveGreeting firstName={firstName} /><p>One clear view of the people, learning, and operations moving through your school today.</p></div><div className="dashboard-actions"><Link href="/reports" className="dashboard-action dashboard-action--primary">View reports <span>-&gt;</span></Link><Link href="/search" className="dashboard-action">Search records <span>&#9906;</span></Link></div></section>
      {membership && school ? <section className="dashboard-workspace-bar"><div><span>Active workspace</span><strong>{school.name}</strong><small>{roleLabel} access / Updated just now</small></div><span className="dashboard-status"><i /> Systems operational</span></section> : <section className="empty-state"><h2>Access is pending.</h2><p>Your account is active, but it has not been connected to a school yet. Ask an administrator to add your school membership.</p></section>}
      {membership?.school_id && <>
        <section className="dashboard-metrics" aria-label="Dashboard summary">{metricCards.map(([label, value, href]) => <Link className="dashboard-metric-card" href={`/${href}`} key={String(label)}><span>{String(label)}</span><strong>{String(value)}</strong><small>View details <em>-&gt;</em></small></Link>)}</section>
        <section className="dashboard-content-grid">
          <article className="dashboard-panel dashboard-panel--attendance"><div className="dashboard-card-heading"><div><span className="dashboard-panel-kicker">Attendance overview</span><h2>Daily presence, last 7 days</h2></div><Link href="/attendance">Open attendance -&gt;</Link></div><div className="dashboard-chart"><div className="dashboard-chart__scale"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><svg viewBox="0 0 620 190" role="img" aria-label="Attendance trend for the last seven days"><path className="dashboard-chart__grid" d="M0 10H620M0 48H620M0 86H620M0 124H620M0 180H620" />{attendance.length > 1 && <><polyline className="dashboard-chart__area" points={`0,190 ${attendance.map((item, index) => pointFor(Number(item.value), index, attendance)).join(" ")} 620,190`} /><polyline className="dashboard-chart__line" points={attendance.map((item, index) => pointFor(Number(item.value), index, attendance)).join(" ")} />{attendance.map((item, index) => { const [x, y] = pointFor(Number(item.value), index, attendance).split(","); return <circle className="dashboard-chart__point" cx={x} cy={y} r="4" key={item.date} />; })}</>}</svg><div className="dashboard-chart__labels">{attendance.map((item) => <span key={item.date}>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(item.date))}</span>)}</div></div><div className="dashboard-insight"><span className="dashboard-insight__signal">&#8599;</span><span>30-day attendance is <strong>{String(metrics.attendance_percentage ?? 0)}%</strong>.</span></div></article>
          <article className="dashboard-panel"><div className="dashboard-card-heading"><div><span className="dashboard-panel-kicker">Finance</span><h2>Fee payments</h2></div><Link href="/finance">Open finance -&gt;</Link></div>{payments.length ? <div className="dashboard-bars">{payments.map((item) => <div key={item.date}><span>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(item.date))}</span><b style={{ width: `${Math.max(2, (Number(item.value) / maxPayment) * 100)}%` }} /><strong>{formatCurrency(item.value)}</strong></div>)}</div> : <p className="dashboard-muted">No payment trend data is available yet.</p>}</article>
          <article className="dashboard-panel"><div className="dashboard-card-heading"><div><span className="dashboard-panel-kicker">Workspace pulse</span><h2>Scale at a glance</h2></div>{roleSlug === "super_admin" && <Link href="/setup">Manage -&gt;</Link>}</div><div className="dashboard-scale"><div><span>Attendance health</span><strong>{String(metrics.attendance_percentage ?? 0)}%</strong></div><div className="dashboard-scale__track"><span style={{ width: `${Math.min(100, Number(metrics.attendance_percentage ?? 0))}%` }} /></div></div><div className="dashboard-scale"><div><span>Active students</span><strong>{String(metrics.students ?? metrics.children ?? 0)}</strong></div><div className="dashboard-scale__track dashboard-scale__track--cyan"><span style={{ width: `${Math.min(100, Number(metrics.students ?? 0))}%` }} /></div></div>{roleSlug === "super_admin" && <div className="dashboard-pulse"><span>Schools added</span><strong>{String(trends.schools_count ?? 0)}</strong><small>Across your admin workspace</small></div>}</article>
        </section>
        <section className="dashboard-panel dashboard-activity"><div className="dashboard-card-heading"><div><span className="dashboard-panel-kicker">Recent activity</span><h2>Changes across this school</h2></div><Link href="/audit">Open audit log -&gt;</Link></div>{activity.length ? <ul>{activity.map((item, index) => <li key={`${item.created_at}-${index}`}><span className="dashboard-activity__icon">&#8226;</span><div><strong>{item.action ?? "Updated"} {item.entity_type ?? "record"}</strong><small>{item.created_at ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at)) : "Recently"}</small></div></li>)}</ul> : <p className="dashboard-muted">No recent activity has been recorded yet.</p>}</section>
        <footer className="dashboard-footer"><span>Signed in as <strong>{user.email}</strong></span><span>Last sign in <strong>{lastSignIn}</strong></span><span>Workspace access is permission scoped</span></footer>
      </>}
    </SchoolivaShell>
  );
}