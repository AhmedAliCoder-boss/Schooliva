"use client";

import { useActionState } from "react";

import {
  addPayrollComponent,
  approvePayroll,
  generatePayroll,
  savePayrollCompensation,
  savePayrollPolicy,
  setPayrollCompensationActive,
  setPayrollComponentActive,
  settlePayrollItem,
  type PayrollFormState,
} from "@/app/actions/payroll";
import { SubmitButton } from "@/components/auth/submit-button";

type EmployeeOption = { value: string; name: string; type: "teacher" | "staff" };

function Feedback({ state }: { state: PayrollFormState | undefined }) {
  return <>
    {state?.error && <p className="student-error" role="alert">{state.error}</p>}
    {state?.success && <p className="student-success" role="status">{state.success}</p>}
  </>;
}

export function PayrollPolicyForm({ policy }: { policy: { working_days_per_month: number; deduct_absences: boolean; half_day_deduction_factor: number; deduct_excused_days: boolean; late_marks_per_day_deduction: number } | null }) {
  const [state, action] = useActionState(savePayrollPolicy, undefined);
  return <form action={action} className="student-form payroll-form">
    <Feedback state={state} />
    <div className="student-form-grid">
      <label className="student-field">Working days used for monthly rate<input name="workingDaysPerMonth" type="number" min="1" max="31" defaultValue={policy?.working_days_per_month ?? 26} required /><small>Daily attendance deduction = monthly salary / this value.</small></label>
      <label className="student-field">Deduct marked absent days<select name="deductAbsences" defaultValue={String(policy?.deduct_absences ?? true)}><option value="true">Yes</option><option value="false">No</option></select></label>
      <label className="student-field">Half-day deduction factor<input name="halfDayDeductionFactor" type="number" min="0" max="1" step="0.05" defaultValue={policy?.half_day_deduction_factor ?? 0.5} required /><small>0 = no deduction; 0.5 = half day; 1 = full day.</small></label>
      <label className="student-field">Deduct excused days<select name="deductExcusedDays" defaultValue={String(policy?.deduct_excused_days ?? false)}><option value="false">No - treat as paid</option><option value="true">Yes - deduct as full day</option></select></label>
      <label className="student-field">Late marks per one-day deduction<input name="lateMarksPerDayDeduction" type="number" min="0" max="31" defaultValue={policy?.late_marks_per_day_deduction ?? 0} required /><small>0 disables late-based deduction. Unmarked days are not deducted.</small></label>
    </div>
    <SubmitButton>Save payroll policy</SubmitButton>
  </form>;
}

export function PayrollCompensationForm({ employees }: { employees: EmployeeOption[] }) {
  const [state, action] = useActionState(savePayrollCompensation, undefined);
  return <form action={action} className="student-form payroll-form">
    <Feedback state={state} />
    <div className="student-form-grid">
      <label className="student-field">Employee<select name="employee" required defaultValue=""><option value="">Select employee</option>{employees.map((employee) => <option key={employee.value} value={employee.value}>{employee.name} - {employee.type === "teacher" ? "Teacher" : "Staff"}</option>)}</select></label>
      <label className="student-field">Monthly base salary<input name="monthlySalary" type="number" min="0.01" step="0.01" required /></label>
    </div>
    <p className="payroll-form__hint">Saving an employee again updates their salary profile. Past payroll runs keep their saved snapshot.</p>
    <SubmitButton>Save salary profile</SubmitButton>
  </form>;
}

export function PayrollComponentForm({ compensationId }: { compensationId: string }) {
  const [state, action] = useActionState(addPayrollComponent, undefined);
  return <form action={action} className="payroll-component-form">
    <Feedback state={state} />
    <input type="hidden" name="compensationId" value={compensationId} />
    <label>Type<select name="componentType" defaultValue="allowance"><option value="allowance">Addition / allowance</option><option value="deduction">Recurring deduction</option></select></label>
    <label>Name<input name="name" placeholder="Fuel, rent, tax..." minLength={2} maxLength={80} required /></label>
    <label>Monthly amount<input name="amount" type="number" min="0.01" step="0.01" required /></label>
    <SubmitButton>Add component</SubmitButton>
  </form>;
}

export function PayrollComponentStatusForm({ componentId, isActive }: { componentId: string; isActive: boolean }) {
  return <form action={setPayrollComponentActive} className="payroll-toggle-form">
    <input type="hidden" name="componentId" value={componentId} />
    <input type="hidden" name="isActive" value={String(!isActive)} />
    <button type="submit">{isActive ? "Disable" : "Enable"}</button>
  </form>;
}

export function PayrollCompensationStatusForm({ compensationId, isActive }: { compensationId: string; isActive: boolean }) {
  return <form action={setPayrollCompensationActive} className="payroll-toggle-form">
    <input type="hidden" name="compensationId" value={compensationId} />
    <input type="hidden" name="isActive" value={String(!isActive)} />
    <button type="submit">{isActive ? "Disable profile" : "Enable profile"}</button>
  </form>;
}

export function GeneratePayrollForm() {
  const [state, action] = useActionState(generatePayroll, undefined);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return <form action={action} className="payroll-inline-form">
    <Feedback state={state} />
    <label>Payroll month<input type="month" name="period" defaultValue={currentMonth} required /></label>
    <SubmitButton>Calculate payroll</SubmitButton>
  </form>;
}

export function ApprovePayrollForm({ payrollRunId }: { payrollRunId: string }) {
  const [state, action] = useActionState(approvePayroll, undefined);
  return <form action={action} className="payroll-inline-form"><Feedback state={state} /><input type="hidden" name="payrollRunId" value={payrollRunId} /><SubmitButton>Approve payroll</SubmitButton></form>;
}

export function SettlePayrollItemForm({ payrollItemId }: { payrollItemId: string }) {
  const [state, action] = useActionState(settlePayrollItem, undefined);
  return <form action={action} className="payroll-settlement-form">
    <Feedback state={state} />
    <input type="hidden" name="payrollItemId" value={payrollItemId} />
    <label>Payment method<select name="paymentMethod" defaultValue="bank_transfer"><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="other">Other</option></select></label>
    <label>Payment reference<input name="reference" minLength={2} maxLength={80} required /></label>
    <SubmitButton>Record salary paid</SubmitButton>
  </form>;
}
