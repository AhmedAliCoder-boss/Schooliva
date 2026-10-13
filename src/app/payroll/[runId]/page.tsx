import Link from "next/link";
import { notFound } from "next/navigation";

import { ApprovePayrollForm, SettlePayrollItemForm } from "@/components/payroll/payroll-forms";
import { requirePayrollContext } from "@/lib/payroll/context";
import { formatCurrency } from "@/lib/format/currency";

type Params = Promise<{ runId: string }>;
type AttendanceSnapshot = { absent?: number; half_day?: number; excused?: number; late?: number };
type CompensationSnapshot = Array<{ type: string; name: string; amount: number }>;

function periodLabel(value: string) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export default async function PayrollRunPage({ params }: { params: Params }) {
  const { runId } = await params;
  const { supabase, schoolId } = await requirePayrollContext("view");
  const [{ data: run, error: runError }, { data: items, error: itemsError }, { data: canManage, error: permissionError }] = await Promise.all([
    supabase.from("payroll_runs").select("id,period_start,status,working_days_per_month,employee_count,total_gross,total_deductions,total_net,created_at").eq("id", runId).eq("school_id", schoolId).maybeSingle(),
    supabase.from("payroll_items").select("id,employee_type,employee_code,employee_name,designation,monthly_salary,attendance_snapshot,components_snapshot,absence_deduction_days,attendance_deduction,allowance_total,fixed_deduction_total,gross_amount,net_amount,status,paid_at").eq("payroll_run_id", runId).eq("school_id", schoolId).order("employee_name"),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "payroll", target_action: "manage" }),
  ]);
  if (runError || itemsError || permissionError) throw new Error("Payroll run data could not be loaded.");
  if (!run) notFound();
  const rows = items ?? [];

  return <main className="students-shell payroll-shell">
    <section className="module-page-header"><div className="module-page-header__row"><div>
      <p className="module-page-header__eyebrow">Salary &amp; payroll / Review</p><h1>{periodLabel(String(run.period_start))}</h1>
      <p>Review attendance, additions, and deductions before marking each salary paid.</p>
    </div><Link className="student-primary-action" href="/payroll">All payroll runs <span aria-hidden="true">→</span></Link></div></section>
    <section className="payroll-run-summary" aria-label="Payroll run totals">
      <article><span>Employees</span><strong>{run.employee_count}</strong></article>
      <article><span>Gross pay</span><strong>{formatCurrency(run.total_gross)}</strong></article>
      <article><span>Total deductions</span><strong>{formatCurrency(run.total_deductions)}</strong></article>
      <article><span>Net pay</span><strong>{formatCurrency(run.total_net)}</strong></article>
      <span className={`payroll-status payroll-status--${run.status}`}>{run.status}</span>
    </section>
    {canManage && run.status === "draft" && <section className="payroll-approval-callout"><div><strong>Review complete?</strong><span>Approving freezes this payroll run. Employee payments can then be recorded individually.</span></div><ApprovePayrollForm payrollRunId={runId} /></section>}
    {rows.length ? <section className="payroll-item-list" aria-label="Employee payroll details">{rows.map((item) => {
      const attendance = item.attendance_snapshot as AttendanceSnapshot;
      const components = item.components_snapshot as CompensationSnapshot;
      return <article className="payroll-item-card" key={String(item.id)}>
        <header><div><strong>{item.employee_name}</strong><span>{item.employee_type === "teacher" ? "Teacher" : "Staff"} · {item.employee_code} · {item.designation}</span></div><span className={`payroll-status payroll-status--${item.status}`}>{item.status}</span></header>
        <div className="payroll-item-breakdown">
          <div><span>Base monthly salary</span><strong>{formatCurrency(item.monthly_salary)}</strong></div>
          <div><span>Attendance</span><strong>{attendance.absent ?? 0} absent · {attendance.half_day ?? 0} half-day · {attendance.late ?? 0} late</strong></div>
          <div><span>Attendance deduction ({item.absence_deduction_days} day-equivalent)</span><strong>- {formatCurrency(item.attendance_deduction)}</strong></div>
          <div><span>Allowances and additions</span><strong>+ {formatCurrency(item.allowance_total)}</strong></div>
          <div><span>Recurring deductions</span><strong>- {formatCurrency(item.fixed_deduction_total)}</strong></div>
          <div className="payroll-item-breakdown__net"><span>Net salary</span><strong>{formatCurrency(item.net_amount)}</strong></div>
        </div>
        {components.length > 0 && <ul className="payroll-item-components">{components.map((component, index) => <li key={`${component.type}-${component.name}-${index}`}><span>{component.type === "allowance" ? "+" : "-"} {component.name}</span><strong>{formatCurrency(component.amount)}</strong></li>)}</ul>}
        {canManage && run.status !== "draft" && item.status === "pending" && <SettlePayrollItemForm payrollItemId={String(item.id)} />}
        {item.status === "paid" && <p className="payroll-item-card__paid">Payment recorded{item.paid_at ? ` on ${new Date(String(item.paid_at)).toLocaleDateString()}` : ""}; salary expense added to the finance register.</p>}
        {item.status === "not_payable" && <p className="payroll-item-card__paid">Net salary is zero under the saved deductions; no payment entry is required.</p>}
        <Link className="school-document-link no-print" href={`/payroll/${runId}/slips/${item.id}`}>Salary slip / PDF</Link>
      </article>;
    })}</section> : <div className="student-empty"><h3>No payroll details</h3><p>This payroll run has no employee items.</p></div>}
  </main>;
}
