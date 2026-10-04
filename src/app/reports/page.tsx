import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format/currency";
import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { ProgressWheel } from "@/components/progress-wheel";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { schoolId, isMasterAdmin } = await getActiveSchoolContext(supabase, user.id);
  if (!schoolId) redirect(isMasterAdmin ? "/admin" : "/setup?onboarding=1");
  const { data: summary } = await supabase.rpc("report_summary", { target_school_id: schoolId, from_date: null, to_date: null, class_filter: null, section_filter: null, session_filter: null });
  const payload = summary ?? {};
  const presentRate = Number(payload.attendance_summary?.present_rate ?? 0);
  const lowStockCount = Number(payload.inventory_summary?.low_stock_items ?? 0);
  const inventoryCount = Number(payload.inventory_summary?.total_items ?? 0);
  const metrics = [
    { label: "Students", value: payload.student_summary?.total_students ?? 0 },
    { label: "Attendance", value: `${presentRate}%`, percentage: presentRate, color: "#047857", detail: "average present rate" },
    { label: "Fee collected", value: formatCurrency(payload.fee_summary?.total_collected) },
    { label: "Published exams", value: payload.result_summary?.published_exams ?? 0 },
    { label: "Teachers", value: payload.teacher_summary?.active_teachers ?? 0 },
    { label: "Library", value: payload.library_summary?.books_total ?? 0 },
    { label: "Routes", value: payload.transport_summary?.active_routes ?? 0 },
    { label: "Low stock", value: lowStockCount, percentage: inventoryCount ? lowStockCount / inventoryCount * 100 : 0, color: "#be123c", detail: `${lowStockCount} of ${inventoryCount} items` },
  ];
  return <main className="students-shell">
    <header className="students-header">
      <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <a className="text-action" href="/reports/export">Export CSV</a>
        <Link className="text-action" href="/dashboard">Dashboard -&gt;</Link>
      </div>
    </header>
    <section className="module-page-header">
      <div className="module-page-header__row">
        <div>
          <p className="module-page-header__eyebrow">Reports</p>
          <h1>School reports and exports.</h1>
          <p>Server-side summaries tuned for student, attendance, fee, results, teacher, library, transport, and inventory reporting.</p>
        </div>
      </div>
    </section>
    <section className="module-kpi-grid">
      {metrics.map((metric) => metric.percentage !== undefined
        ? <ProgressWheel key={metric.label} label={metric.label} value={metric.value} percentage={metric.percentage} color={metric.color ?? "#2563eb"} detail={metric.detail} />
        : <article className="module-kpi" key={metric.label}><span>{metric.label}</span><strong>{String(metric.value)}</strong></article>)}
    </section>
  </main>;
}
