import Link from "next/link";

import { FinanceFormDisclosure } from "@/components/finance/finance-form-disclosure";
import { GeneratePayrollForm } from "@/components/payroll/payroll-forms";
import { requirePayrollContext } from "@/lib/payroll/context";
import { formatCurrency } from "@/lib/format/currency";

function periodLabel(value: string) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export default async function PayrollPage() {
  const { supabase, schoolId } = await requirePayrollContext("view");
  const [{ data: runs, error: runsError }, { data: policy, error: policyError }, { count: profiles, error: profilesError }] = await Promise.all([
    supabase.from("payroll_runs").select("id,period_start,status,employee_count,total_gross,total_deductions,total_net,created_at").eq("school_id", schoolId).order("period_start", { ascending: false }),
    supabase.from("payroll_policies").select("working_days_per_month").eq("school_id", schoolId).maybeSingle(),
    supabase.from("payroll_compensations").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("is_active", true),
  ]);
  if (runsError || policyError || profilesError) throw new Error("Payroll workspace could not be loaded.");
  const runRows = runs ?? [];
  const outstandingRuns = runRows.filter((run) => run.status !== "paid").length;
  const currentRun = runRows[0];

  return <main className="students-shell payroll-shell">
    <section className="module-page-header"><div className="module-page-header__row"><div>
      <p className="module-page-header__eyebrow">Finance / HR</p><h1>Salary &amp; payroll</h1>
      <p>Set compensation, apply attendance-based rules, review payroll, and record employee payments.</p>
    </div><Link className="student-primary-action" href="/payroll/settings">Payroll settings <span aria-hidden="true">→</span></Link></div></section>
    <section className="payroll-metrics" aria-label="Payroll summary">
      <article><span>Active salary profiles</span><strong>{profiles ?? 0}</strong><small>Teachers and staff</small></article>
      <article><span>Payroll runs</span><strong>{runRows.length}</strong><small>{outstandingRuns} awaiting completion</small></article>
      <article><span>Latest payroll</span><strong>{currentRun ? formatCurrency(currentRun.total_net) : formatCurrency(0)}</strong><small>{currentRun ? periodLabel(String(currentRun.period_start)) : "No payroll run yet"}</small></article>
      <article><span>Attendance divisor</span><strong>{policy?.working_days_per_month ?? "—"}</strong><small>{policy ? "Working days / month" : "Configure payroll policy"}</small></article>
    </section>
    <section className="payroll-primary-action">
      <div><span className="dashboard-panel-kicker">Monthly process</span><h2>Calculate a payroll run</h2><p>Uses the saved salary profiles, recurring additions/deductions, school policy, and recorded people attendance for the selected month.</p></div>
      {policy ? <GeneratePayrollForm /> : <Link href="/payroll/settings" className="dashboard-action dashboard-action--primary">Configure payroll settings <span aria-hidden="true">→</span></Link>}
    </section>
    <section className="payroll-history" aria-labelledby="payroll-history-title">
      <header className="finance-work-card__heading"><div><span className="dashboard-panel-kicker">Payroll register</span><h2 id="payroll-history-title">Payroll history</h2><p>Each run keeps its own attendance and compensation snapshot.</p></div></header>
      {runRows.length ? <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Pay period</th><th>Employees</th><th>Gross</th><th>Deductions</th><th>Net pay</th><th>Status</th><th></th></tr></thead><tbody>{runRows.map((run) => <tr key={String(run.id)}>
        <td><strong>{periodLabel(String(run.period_start))}</strong></td><td>{run.employee_count}</td><td>{formatCurrency(run.total_gross)}</td><td>{formatCurrency(run.total_deductions)}</td><td><strong>{formatCurrency(run.total_net)}</strong></td><td><span className={`payroll-status payroll-status--${run.status}`}>{run.status}</span></td><td><Link href={`/payroll/${run.id}`} className="payroll-view-link">Review run →</Link></td>
      </tr>)}</tbody></table></div> : <div className="student-empty"><h3>No payroll runs yet</h3><p>Set employee salaries and a payroll policy, then calculate the first monthly run.</p></div>}
      {runRows.length > 0 && <FinanceFormDisclosure label="Important" title="How payroll is calculated" description="Review the policy and snapshot behavior before generating a run.">
        <ul className="payroll-explanation"><li>Attendance deductions use the policy divisor and only attendance records explicitly marked for this month.</li><li>Fuel, rent, and other recurring components are snapshotted into each payroll run.</li><li>Approving a run locks the calculated amounts; recording each payment also adds a salary expense entry.</li></ul>
      </FinanceFormDisclosure>}
    </section>
  </main>;
}
