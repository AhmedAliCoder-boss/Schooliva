import Link from "next/link";

import { FinanceFormDisclosure } from "@/components/finance/finance-form-disclosure";
import { PayrollComponentForm, PayrollComponentStatusForm, PayrollCompensationForm, PayrollCompensationStatusForm, PayrollPolicyForm } from "@/components/payroll/payroll-forms";
import { requirePayrollContext } from "@/lib/payroll/context";
import { formatCurrency } from "@/lib/format/currency";

type Employee = { id: string; employee_code: string; first_name: string; last_name: string; designation?: string | null; specialization?: string | null };
type EmployeeLabel = Employee & { type: "Teacher" | "Staff" };

export default async function PayrollSettingsPage() {
  const { supabase, schoolId } = await requirePayrollContext("view");
  const [{ data: policy, error: policyError }, { data: teachers, error: teachersError }, { data: staff, error: staffError }, { data: compensations, error: compensationError }, { data: components, error: componentsError }, { data: canManage, error: permissionError }, { data: canConfigurePolicy, error: policyPermissionError }] = await Promise.all([
    supabase.from("payroll_policies").select("working_days_per_month,deduct_absences,half_day_deduction_factor,deduct_excused_days,late_marks_per_day_deduction").eq("school_id", schoolId).maybeSingle(),
    supabase.from("teachers").select("id,employee_code,first_name,last_name,specialization").eq("school_id", schoolId).eq("is_active", true).eq("employment_status", "active").is("deleted_at", null).order("last_name"),
    supabase.from("staff").select("id,employee_code,first_name,last_name,designation").eq("school_id", schoolId).eq("is_active", true).eq("employment_status", "active").is("deleted_at", null).order("last_name"),
    supabase.from("payroll_compensations").select("id,teacher_id,staff_id,monthly_salary,is_active").eq("school_id", schoolId).order("created_at"),
    supabase.from("payroll_compensation_components").select("id,compensation_id,component_type,name,amount,is_active").eq("school_id", schoolId).order("name"),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "payroll", target_action: "manage" }),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "payroll_policy", target_action: "manage" }),
  ]);
  if (policyError || teachersError || staffError || compensationError || componentsError || permissionError || policyPermissionError) throw new Error("Payroll settings could not be loaded.");
  const teacherRows = (teachers ?? []) as Employee[];
  const staffRows = (staff ?? []) as Employee[];
  const employeeEntries: Array<[string, EmployeeLabel]> = [
    ...teacherRows.map((employee): [string, EmployeeLabel] => [employee.id, { ...employee, type: "Teacher" }]),
    ...staffRows.map((employee): [string, EmployeeLabel] => [employee.id, { ...employee, type: "Staff" }]),
  ];
  const employeeById = new Map(employeeEntries);
  const employeeOptions = [
    ...teacherRows.map((employee) => ({ value: `teacher:${employee.id}`, name: `${employee.first_name} ${employee.last_name} (${employee.employee_code})`, type: "teacher" as const })),
    ...staffRows.map((employee) => ({ value: `staff:${employee.id}`, name: `${employee.first_name} ${employee.last_name} - ${employee.designation} (${employee.employee_code})`, type: "staff" as const })),
  ];
  const componentRows = components ?? [];
  const componentByProfile = new Map<string, typeof componentRows>();
  for (const component of componentRows) {
    const current = componentByProfile.get(String(component.compensation_id)) ?? [];
    current.push(component);
    componentByProfile.set(String(component.compensation_id), current);
  }

  return <main className="students-shell payroll-shell">
    <section className="module-page-header"><div className="module-page-header__row"><div>
      <p className="module-page-header__eyebrow">Salary &amp; payroll / Settings</p><h1>Payroll settings</h1>
      <p>Principal-configured attendance rules, monthly salary profiles, allowances, and deductions.</p>
    </div><Link className="student-primary-action" href="/payroll">Payroll workspace <span aria-hidden="true">→</span></Link></div></section>
    {canManage && <div className="payroll-settings-stack">
      {canConfigurePolicy && <FinanceFormDisclosure label="Policy" title="Attendance and deduction policy" description="Set the rules applied when each monthly payroll run is calculated.">
        <PayrollPolicyForm policy={policy} />
      </FinanceFormDisclosure>}
      <FinanceFormDisclosure label="Compensation" title="Add or update monthly salary" description="Set a teacher or staff member's base monthly salary. Accountants can be added as staff using their staff record.">
        {employeeOptions.length ? <PayrollCompensationForm employees={employeeOptions} /> : <div className="student-empty"><h3>No active employees found</h3><p>Add active teacher or staff records before setting salaries.</p></div>}
      </FinanceFormDisclosure>
    </div>}
    <section className="payroll-history" aria-labelledby="compensation-register-title">
      <header className="finance-work-card__heading"><div><span className="dashboard-panel-kicker">Restricted payroll data</span><h2 id="compensation-register-title">Employee salary profiles</h2><p>Only users with payroll view permission can access these amounts.</p></div></header>
      {(compensations ?? []).length ? <div className="payroll-profile-list">{compensations?.map((compensation) => {
        const employeeId = String(compensation.teacher_id ?? compensation.staff_id ?? "");
        const employee = employeeById.get(employeeId);
        const employeeComponents = componentByProfile.get(String(compensation.id)) ?? [];
        return <article className="payroll-profile-card" key={String(compensation.id)}>
          <div className="payroll-profile-card__heading"><div><strong>{employee ? `${employee.first_name} ${employee.last_name}` : "Inactive employee"}</strong><span>{employee ? `${employee.type} · ${employee.employee_code} · ${employee.designation ?? employee.specialization ?? "Employee"}` : "Employee record is no longer active"} · {compensation.is_active ? "Payroll active" : "Payroll disabled"}</span></div><strong>{formatCurrency(compensation.monthly_salary)}<small> / month</small></strong></div>
          {canManage && <PayrollCompensationStatusForm compensationId={String(compensation.id)} isActive={Boolean(compensation.is_active)} />}
          <div className="payroll-components">{employeeComponents.length ? employeeComponents.map((component) => <div key={String(component.id)} className={`payroll-component payroll-component--${component.component_type} ${component.is_active ? "" : "is-disabled"}`}><i>{component.component_type === "allowance" ? "+" : "-"}</i>{component.name}: {formatCurrency(component.amount)}{canManage && <PayrollComponentStatusForm componentId={String(component.id)} isActive={Boolean(component.is_active)} />}</div>) : <span className="payroll-form__hint">No recurring additions or deductions yet.</span>}</div>
          {canManage && <FinanceFormDisclosure label="Salary components" title="Add recurring allowance or deduction" description="Examples: fuel allowance, rent allowance, tax, or other monthly deduction.">
            <PayrollComponentForm compensationId={String(compensation.id)} />
          </FinanceFormDisclosure>}
        </article>;
      })}</div> : <div className="student-empty"><h3>No salary profiles configured</h3><p>Set a monthly salary for each employee who should be included in payroll.</p></div>}
    </section>
  </main>;
}
