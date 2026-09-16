import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { data: membership } = await supabase.from("user_roles").select("school_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership?.school_id) redirect("/setup?onboarding=1");
  const { data: summary } = await supabase.rpc("report_summary", { target_school_id: membership.school_id, from_date: null, to_date: null, class_filter: null, section_filter: null, session_filter: null });
  const payload = summary ?? {};
  return <main className="students-shell"><header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/dashboard">Dashboard -&gt;</Link></header><section className="students-heading"><div><p className="eyebrow">Reports</p><h1>School reports and exports.</h1><p>Server-side summaries tuned for student, attendance, fee, results, teacher, library, transport, and inventory reporting.</p></div></section><section className="dashboard-metrics">{[
    ["Students", payload.student_summary?.total_students ?? 0],
    ["Attendance", `${payload.attendance_summary?.present_rate ?? 0}%`],
    ["Fee collected", payload.fee_summary?.total_collected ?? 0],
    ["Published exams", payload.result_summary?.published_exams ?? 0],
    ["Teachers", payload.teacher_summary?.active_teachers ?? 0],
    ["Library", payload.library_summary?.books_total ?? 0],
    ["Routes", payload.transport_summary?.active_routes ?? 0],
    ["Low stock", payload.inventory_summary?.low_stock_items ?? 0],
  ].map(([label, value]) => <article className="dashboard-metric-card" key={String(label)}><span>{String(label)}</span><strong>{String(value)}</strong><small>Export friendly</small></article>)}</section></main>;
}
