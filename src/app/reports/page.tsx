import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format/currency";
import { getActiveSchoolContext } from "@/lib/admin/school-context";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { schoolId, isMasterAdmin } = await getActiveSchoolContext(supabase, user.id);
  if (!schoolId) redirect(isMasterAdmin ? "/admin" : "/setup?onboarding=1");
  const { data: summary } = await supabase.rpc("report_summary", { target_school_id: schoolId, from_date: null, to_date: null, class_filter: null, section_filter: null, session_filter: null });
  const payload = summary ?? {};
  return <main className="students-shell"><header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><div style={{ display: "flex", gap: 12, alignItems: "center" }}><a className="text-action" href="/reports/export">Export CSV</a><Link className="text-action" href="/dashboard">Dashboard -&gt;</Link></div></header><section className="module-page-header"><div className="module-page-header__row"><div><p className="module-page-header__eyebrow">Reports</p><h1>School reports and exports.</h1><p>Server-side summaries tuned for student, attendance, fee, results, teacher, library, transport, and inventory reporting.</p></div></div></section><section className="module-kpi-grid">{[
    ["Students", payload.student_summary?.total_students ?? 0],
    ["Attendance", `${payload.attendance_summary?.present_rate ?? 0}%`],
    ["Fee collected", formatCurrency(payload.fee_summary?.total_collected)],
    ["Published exams", payload.result_summary?.published_exams ?? 0],
    ["Teachers", payload.teacher_summary?.active_teachers ?? 0],
    ["Library", payload.library_summary?.books_total ?? 0],
    ["Routes", payload.transport_summary?.active_routes ?? 0],
    ["Low stock", payload.inventory_summary?.low_stock_items ?? 0],
  ].map(([label, value]) => <article className="module-kpi" key={String(label)}><span>{String(label)}</span><strong>{String(value)}</strong></article>)}</section></main>;
}
