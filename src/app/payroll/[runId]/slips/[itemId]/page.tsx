import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintAction } from "@/components/print/print-action";
import { SchoolDocument } from "@/components/print/school-document";
import { requirePayrollContext } from "@/lib/payroll/context";
import { formatCurrency } from "@/lib/format/currency";
import { getSchoolDocumentIdentity } from "@/lib/print/school-document";
import { calculatePayrollAttendanceBreakdown } from "@/lib/payroll/calculation";

type Params = Promise<{ runId: string; itemId: string }>;
type AttendanceSnapshot = { absent?: number; half_day?: number; excused?: number; late?: number };
type CompensationSnapshot = Array<{ type: string; name: string; amount: number }>;

function componentLabel(name: string, type: string) {
  const category = type === "allowance" ? "allowance" : "deduction";
  return new RegExp(`\\b${category}\\b`, "i").test(name) ? name : `${name} (${category})`;
}

export default async function SalarySlipPage({ params }: { params: Params }) {
  const { runId, itemId } = await params;
  const { supabase, schoolId } = await requirePayrollContext("view");
  const [{ data: run, error: runError }, { data: item, error: itemError }] = await Promise.all([
    supabase.from("payroll_runs").select("id,period_start,status,working_days_per_month,deduct_absences,half_day_deduction_factor,deduct_excused_days,late_marks_per_day_deduction").eq("id", runId).eq("school_id", schoolId).maybeSingle(),
    supabase.from("payroll_items").select("id,payroll_run_id,employee_type,employee_code,employee_name,designation,monthly_salary,attendance_snapshot,components_snapshot,absence_deduction_days,attendance_deduction,allowance_total,fixed_deduction_total,gross_amount,net_amount,status,paid_at").eq("id", itemId).eq("payroll_run_id", runId).eq("school_id", schoolId).maybeSingle(),
  ]);
  if (runError || itemError) throw new Error("Salary slip could not be loaded.");
  if (!run || !item) notFound();
  const school = await getSchoolDocumentIdentity(supabase, schoolId);
  const attendance = item.attendance_snapshot as AttendanceSnapshot;
  const components = item.components_snapshot as CompensationSnapshot;
  const allowances = components.filter((component) => component.type === "allowance");
  const recurringDeductions = components.filter((component) => component.type === "deduction");
  const policyAvailable = run.deduct_absences !== null
    && run.half_day_deduction_factor !== null
    && run.deduct_excused_days !== null
    && run.late_marks_per_day_deduction !== null;
  const attendanceBreakdown = policyAvailable ? calculatePayrollAttendanceBreakdown(Number(item.monthly_salary), {
    absent: Number(attendance.absent ?? 0),
    halfDay: Number(attendance.half_day ?? 0),
    excused: Number(attendance.excused ?? 0),
    late: Number(attendance.late ?? 0),
  }, {
    workingDaysPerMonth: Number(run.working_days_per_month),
    deductAbsences: Boolean(run.deduct_absences),
    halfDayDeductionFactor: Number(run.half_day_deduction_factor),
    deductExcusedDays: Boolean(run.deduct_excused_days),
    lateMarksPerDayDeduction: Number(run.late_marks_per_day_deduction),
  }) : null;
  const month = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${run.period_start}T00:00:00Z`));

  return <main className="school-document-page"><div className="school-document-toolbar no-print"><Link href={`/payroll/${runId}`}>Back to payroll run</Link><PrintAction label="Print salary slip / Save PDF" /></div>
    <SchoolDocument school={school} title="Salary slip" reference={`${item.employee_code} · ${month}`}>
      <dl className="school-document__facts">
        <div><dt>Employee</dt><dd>{item.employee_name}</dd></div>
        <div><dt>Employee ID</dt><dd>{item.employee_code}</dd></div>
        <div><dt>Role</dt><dd>{item.employee_type === "teacher" ? "Teacher" : "Staff"} · {item.designation}</dd></div>
        <div><dt>Pay period</dt><dd>{month}</dd></div>
        <div><dt>Payment status</dt><dd>{String(item.status).replaceAll("_", " ")}</dd></div>
        {item.paid_at && <div><dt>Paid on</dt><dd>{new Date(String(item.paid_at)).toLocaleDateString()}</dd></div>}
      </dl>
      <h3 className="school-document__section-title">Earnings</h3>
      <table className="school-document__table"><thead><tr><th>Earning details</th><th>Amount</th></tr></thead><tbody>
        <tr><td>Base monthly salary</td><td>{formatCurrency(item.monthly_salary)}</td></tr>
        {allowances.map((component, index) => <tr key={`${component.name}-${index}`}><td>{componentLabel(component.name, component.type)}</td><td>+ {formatCurrency(component.amount)}</td></tr>)}
        <tr className="is-emphasis"><td>Total gross earnings</td><td>{formatCurrency(item.gross_amount)}</td></tr>
      </tbody></table>
      <h3 className="school-document__section-title">Attendance and deductions</h3>
      <table className="school-document__table"><thead><tr><th>Deduction detail</th><th>Attendance</th><th>Day equivalent</th><th>Amount</th></tr></thead><tbody>
        {attendanceBreakdown ? attendanceBreakdown.items.map((entry) => {
          const labels = { absent: "Absent", halfDay: "Half day", excused: "Excused leave", late: "Late marks" };
          const deductionRule = entry.key === "absent" && !run.deduct_absences
            ? "No deduction per policy"
            : entry.key === "excused" && !run.deduct_excused_days
              ? "Paid leave per policy"
              : entry.key === "late" && run.late_marks_per_day_deduction === 0
                ? "No late deduction per policy"
                : null;
          return <tr key={entry.key}>
            <td>{labels[entry.key]}{deductionRule ? ` · ${deductionRule}` : ""}</td>
            <td>{entry.count}</td>
            <td>{entry.deductionDays}</td>
            <td>{entry.amount ? `- ${formatCurrency(entry.amount)}` : formatCurrency(0)}</td>
          </tr>;
        }) : <>
          <tr><td>Absent days</td><td>{attendance.absent ?? 0}</td><td>Policy detail unavailable</td><td>Included below</td></tr>
          <tr><td>Half days</td><td>{attendance.half_day ?? 0}</td><td>Policy detail unavailable</td><td>Included below</td></tr>
          <tr><td>Excused leave</td><td>{attendance.excused ?? 0}</td><td>Policy detail unavailable</td><td>Included below</td></tr>
          <tr><td>Late marks</td><td>{attendance.late ?? 0}</td><td>Policy detail unavailable</td><td>Included below</td></tr>
        </>}
        {recurringDeductions.map((component, index) => <tr key={`${component.name}-${index}`}><td>{componentLabel(component.name, component.type)}</td><td>—</td><td>—</td><td>- {formatCurrency(component.amount)}</td></tr>)}
        <tr><td>Recurring deductions total</td><td>—</td><td>—</td><td>- {formatCurrency(item.fixed_deduction_total)}</td></tr>
        <tr><td>Attendance deduction total</td><td>{Number(attendance.absent ?? 0) + Number(attendance.half_day ?? 0) + Number(attendance.excused ?? 0) + Number(attendance.late ?? 0)} marked days</td><td>{item.absence_deduction_days}</td><td>- {formatCurrency(item.attendance_deduction)}</td></tr>
        <tr className="is-emphasis"><td colSpan={3}>Total deductions</td><td>- {formatCurrency(Number(item.fixed_deduction_total) + Number(item.attendance_deduction))}</td></tr>
        <tr className="is-emphasis"><td colSpan={3}>Net salary payable</td><td>{formatCurrency(item.net_amount)}</td></tr>
      </tbody></table>
      {!policyAvailable && <p className="school-document__notice">This payroll run predates attendance-policy snapshots. Marked days and the recorded total deduction are shown; per-status amounts cannot be reconstructed accurately for this historical run.</p>}
      {policyAvailable && <p className="school-document__notice">Attendance rates use {run.working_days_per_month} working days per month. Deduction amounts reflect the saved policy for this payroll run.</p>}
      <p className="school-document__notice">Payroll status: {String(run.status).replaceAll("_", " ")}. Keep this document for your records.</p>
      <div className="school-document__signatures"><span>Employee signature</span><span>Authorized signature</span></div>
    </SchoolDocument>
  </main>;
}
