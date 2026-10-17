"use server";

import { revalidatePath } from "next/cache";

import { requirePayrollContext } from "@/lib/payroll/context";
import {
  compensationComponentSchema,
  payrollCompensationSchema,
  payrollPeriodSchema,
  payrollPolicySchema,
  payrollRunActionSchema,
  payrollSettlementSchema,
  payrollStatusSchema,
} from "@/lib/payroll/schemas";

function fields(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export type PayrollFormState = { error?: string; success?: string };

function revalidatePayroll() {
  for (const path of ["/payroll", "/payroll/settings", "/payroll/history"]) revalidatePath(path);
}

export async function savePayrollPolicy(_: PayrollFormState | undefined, formData: FormData): Promise<PayrollFormState> {
  const parsed = payrollPolicySchema.safeParse(fields(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Payroll policy is invalid." };
  const { supabase, schoolId, user } = await requirePayrollContext("configure-policy");
  const { error } = await supabase.from("payroll_policies").upsert({
    school_id: schoolId,
    working_days_per_month: parsed.data.workingDaysPerMonth,
    deduct_absences: parsed.data.deductAbsences,
    half_day_deduction_factor: parsed.data.halfDayDeductionFactor,
    deduct_excused_days: parsed.data.deductExcusedDays,
    late_marks_per_day_deduction: parsed.data.lateMarksPerDayDeduction,
    updated_by: user.id,
  }, { onConflict: "school_id" });
  if (error) return { error: "Payroll policy could not be saved." };
  revalidatePayroll();
  return { success: "Payroll policy saved." };
}

export async function savePayrollCompensation(_: PayrollFormState | undefined, formData: FormData): Promise<PayrollFormState> {
  const parsed = payrollCompensationSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Salary details are invalid." };
  const { supabase, schoolId, user } = await requirePayrollContext("manage");
  const table = parsed.data.employeeType === "teacher" ? "teachers" : "staff";
  const { data: employee, error: employeeError } = await supabase.from(table)
    .select("id").eq("id", parsed.data.employeeId).eq("school_id", schoolId).eq("employment_status", "active").eq("is_active", true).is("deleted_at", null).maybeSingle();
  if (employeeError) return { error: "Employee record could not be verified." };
  if (!employee) return { error: "Selected active employee is not available in this school." };

  const personColumn = parsed.data.employeeType === "teacher" ? "teacher_id" : "staff_id";
  const { data: current, error: currentError } = await supabase.from("payroll_compensations").select("id")
    .eq("school_id", schoolId).eq(personColumn, employee.id).maybeSingle();
  if (currentError) return { error: "The existing salary profile could not be loaded." };
  const salaryProfile = {
    school_id: schoolId,
    teacher_id: parsed.data.employeeType === "teacher" ? employee.id : null,
    staff_id: parsed.data.employeeType === "staff" ? employee.id : null,
    monthly_salary: parsed.data.monthlySalary,
    is_active: true,
    updated_by: user.id,
  };
  const { error } = current
    ? await supabase.from("payroll_compensations").update(salaryProfile).eq("id", current.id).eq("school_id", schoolId)
    : await supabase.from("payroll_compensations").insert(salaryProfile);
  if (error) return { error: "Salary profile could not be saved." };
  revalidatePayroll();
  return { success: "Monthly salary profile saved." };
}

export async function addPayrollComponent(_: PayrollFormState | undefined, formData: FormData): Promise<PayrollFormState> {
  const parsed = compensationComponentSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Salary component is invalid." };
  const { supabase, schoolId, user } = await requirePayrollContext("manage");
  const { data: compensation, error: compensationError } = await supabase.from("payroll_compensations")
    .select("id").eq("id", parsed.data.compensationId).eq("school_id", schoolId).maybeSingle();
  if (compensationError) return { error: "Salary profile could not be verified." };
  if (!compensation) return { error: "Selected salary profile is unavailable." };
  const { error } = await supabase.from("payroll_compensation_components").insert({
    school_id: schoolId,
    compensation_id: compensation.id,
    component_type: parsed.data.componentType,
    name: parsed.data.name,
    amount: parsed.data.amount,
    created_by: user.id,
  });
  if (error) return { error: "Recurring salary component could not be added." };
  revalidatePayroll();
  return { success: "Recurring salary component added." };
}

export async function setPayrollComponentActive(formData: FormData): Promise<void> {
  const parsed = payrollStatusSchema.safeParse({ id: formData.get("componentId"), isActive: formData.get("isActive") });
  if (!parsed.success) throw new Error("Salary component status input is invalid.");
  const { supabase, schoolId } = await requirePayrollContext("manage");
  const { data, error } = await supabase.from("payroll_compensation_components").update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.id).eq("school_id", schoolId).select("id").maybeSingle();
  if (error || !data) throw new Error("Salary component status could not be updated.");
  revalidatePayroll();
}

export async function setPayrollCompensationActive(formData: FormData): Promise<void> {
  const parsed = payrollStatusSchema.safeParse({ id: formData.get("compensationId"), isActive: formData.get("isActive") });
  if (!parsed.success) throw new Error("Salary profile status input is invalid.");
  const { supabase, schoolId } = await requirePayrollContext("manage");
  const { data, error } = await supabase.from("payroll_compensations").update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.id).eq("school_id", schoolId).select("id").maybeSingle();
  if (error || !data) throw new Error("Salary profile status could not be updated.");
  revalidatePayroll();
}

export async function generatePayroll(_: PayrollFormState | undefined, formData: FormData): Promise<PayrollFormState> {
  const parsed = payrollPeriodSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: "Select a valid payroll month." };
  const { supabase, schoolId } = await requirePayrollContext("manage");
  const { data, error } = await supabase.rpc("generate_school_payroll", {
    target_school_id: schoolId,
    target_period_start: `${parsed.data.period}-01`,
  });
  if (error) {
    if (error.code === "23505") return { error: "A payroll run already exists for this month." };
    if (error.message.includes("No active employees")) return { error: "No active salary profiles were found for payroll." };
    if (error.message.includes("Configure the payroll policy")) return { error: "Configure the payroll policy in Payroll settings first." };
    return { error: "Payroll could not be calculated. Check the settings and attendance." };
  }
  revalidatePayroll();
  return { success: `Payroll run generated (${String(data)}).` };
}

export async function approvePayroll(_: PayrollFormState | undefined, formData: FormData): Promise<PayrollFormState> {
  const parsed = payrollRunActionSchema.safeParse({ payrollRunId: formData.get("payrollRunId") });
  if (!parsed.success) return { error: "Payroll run ID is invalid." };
  const runId = parsed.data.payrollRunId;
  const { supabase, schoolId } = await requirePayrollContext("manage");
  const { error } = await supabase.rpc("approve_school_payroll", {
    target_school_id: schoolId,
    target_payroll_run_id: runId,
  });
  if (error) return { error: "Payroll run could not be approved. Check its status and try again." };
  revalidatePayroll();
  revalidatePath(`/payroll/${runId}`);
  return { success: "Payroll run approved. You can now record individual salary payments." };
}

export async function settlePayrollItem(_: PayrollFormState | undefined, formData: FormData): Promise<PayrollFormState> {
  const parsed = payrollSettlementSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Payment details are invalid." };
  const { supabase, schoolId } = await requirePayrollContext("manage");
  const { data: item, error: itemError } = await supabase.from("payroll_items").select("payroll_run_id")
    .eq("id", parsed.data.payrollItemId).eq("school_id", schoolId).maybeSingle();
  if (itemError) return { error: "Payroll item could not be verified." };
  if (!item) return { error: "Selected payroll item is unavailable." };
  const { error } = await supabase.rpc("settle_school_payroll_item", {
    target_school_id: schoolId,
    target_payroll_item_id: parsed.data.payrollItemId,
    target_payment_method: parsed.data.paymentMethod,
    target_reference: parsed.data.reference,
  });
  if (error) {
    if (error.message.includes("Approve this payroll run")) return { error: "Approve the payroll run first." };
    if (error.message.includes("already paid")) return { error: "This payroll item has already been recorded as paid." };
    return { error: "Salary payment could not be recorded." };
  }
  revalidatePayroll();
  revalidatePath(`/payroll/${item.payroll_run_id}`);
  return { success: "Salary payment recorded and expense register updated." };
}
