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
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Payroll policy invalid hai." };
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
  if (error) return { error: "Payroll policy save nahi ho saki." };
  revalidatePayroll();
  return { success: "Payroll policy save ho gayi." };
}

export async function savePayrollCompensation(_: PayrollFormState | undefined, formData: FormData): Promise<PayrollFormState> {
  const parsed = payrollCompensationSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Salary details invalid hain." };
  const { supabase, schoolId, user } = await requirePayrollContext("manage");
  const table = parsed.data.employeeType === "teacher" ? "teachers" : "staff";
  const { data: employee, error: employeeError } = await supabase.from(table)
    .select("id").eq("id", parsed.data.employeeId).eq("school_id", schoolId).eq("employment_status", "active").eq("is_active", true).is("deleted_at", null).maybeSingle();
  if (employeeError) return { error: "Employee record verify nahi ho saka." };
  if (!employee) return { error: "Selected active employee is not available in this school." };

  const personColumn = parsed.data.employeeType === "teacher" ? "teacher_id" : "staff_id";
  const { data: current, error: currentError } = await supabase.from("payroll_compensations").select("id")
    .eq("school_id", schoolId).eq(personColumn, employee.id).maybeSingle();
  if (currentError) return { error: "Existing salary profile load nahi ho saka." };
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
  if (error) return { error: "Salary profile save nahi ho saka." };
  revalidatePayroll();
  return { success: "Monthly salary profile save ho gaya." };
}

export async function addPayrollComponent(_: PayrollFormState | undefined, formData: FormData): Promise<PayrollFormState> {
  const parsed = compensationComponentSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Salary component invalid hai." };
  const { supabase, schoolId, user } = await requirePayrollContext("manage");
  const { data: compensation, error: compensationError } = await supabase.from("payroll_compensations")
    .select("id").eq("id", parsed.data.compensationId).eq("school_id", schoolId).maybeSingle();
  if (compensationError) return { error: "Salary profile verify nahi ho saka." };
  if (!compensation) return { error: "Selected salary profile is unavailable." };
  const { error } = await supabase.from("payroll_compensation_components").insert({
    school_id: schoolId,
    compensation_id: compensation.id,
    component_type: parsed.data.componentType,
    name: parsed.data.name,
    amount: parsed.data.amount,
    created_by: user.id,
  });
  if (error) return { error: "Recurring salary component add nahi ho saka." };
  revalidatePayroll();
  return { success: "Recurring salary component add ho gaya." };
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
  if (!parsed.success) return { error: "Valid payroll month select karein." };
  const { supabase, schoolId } = await requirePayrollContext("manage");
  const { data, error } = await supabase.rpc("generate_school_payroll", {
    target_school_id: schoolId,
    target_period_start: `${parsed.data.period}-01`,
  });
  if (error) {
    if (error.code === "23505") return { error: "Is month ka payroll run pehle se maujood hai." };
    if (error.message.includes("No active employees")) return { error: "Payroll ke liye active salary profiles nahi mile." };
    if (error.message.includes("Configure the payroll policy")) return { error: "Pehle Payroll settings mein policy configure karein." };
    return { error: "Payroll calculate nahi ho saka. Settings aur attendance check karein." };
  }
  revalidatePayroll();
  return { success: `Payroll run generate ho gaya (${String(data)}).` };
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
  if (error) return { error: "Payroll run approve nahi ho saka. Run state check karke dobara try karein." };
  revalidatePayroll();
  revalidatePath(`/payroll/${runId}`);
  return { success: "Payroll run approve ho gaya. Ab individual salaries record paid kar sakte hain." };
}

export async function settlePayrollItem(_: PayrollFormState | undefined, formData: FormData): Promise<PayrollFormState> {
  const parsed = payrollSettlementSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Payment details invalid hain." };
  const { supabase, schoolId } = await requirePayrollContext("manage");
  const { data: item, error: itemError } = await supabase.from("payroll_items").select("payroll_run_id")
    .eq("id", parsed.data.payrollItemId).eq("school_id", schoolId).maybeSingle();
  if (itemError) return { error: "Payroll item verify nahi ho saka." };
  if (!item) return { error: "Selected payroll item is unavailable." };
  const { error } = await supabase.rpc("settle_school_payroll_item", {
    target_school_id: schoolId,
    target_payroll_item_id: parsed.data.payrollItemId,
    target_payment_method: parsed.data.paymentMethod,
    target_reference: parsed.data.reference,
  });
  if (error) {
    if (error.message.includes("Approve this payroll run")) return { error: "Pehle payroll run approve karein." };
    if (error.message.includes("already paid")) return { error: "Ye payroll item pehle paid record ho chuka hai." };
    return { error: "Salary payment record save nahi ho saka." };
  }
  revalidatePayroll();
  revalidatePath(`/payroll/${item.payroll_run_id}`);
  return { success: "Salary payment record ho gayi aur expense register update ho gaya." };
}
