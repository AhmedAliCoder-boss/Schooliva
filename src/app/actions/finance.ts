"use server";

import { revalidatePath } from "next/cache";
import { requireFinanceContext } from "@/lib/finance/context";
import { expenseSchema, feeStructureSchema, invoiceSchema, paymentSchema, type FinanceFormState } from "@/lib/finance/schemas";

function values(formData: FormData) {
  const result: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  for (const [key, value] of formData.entries()) {
    const existing = result[key];
    result[key] = existing === undefined ? value : Array.isArray(existing) ? [...existing, value] : [existing, value];
  }
  if (result.feeStructureIds !== undefined && !Array.isArray(result.feeStructureIds)) {
    result.feeStructureIds = [result.feeStructureIds];
  }
  return result;
}

function revalidateFinance() {
  for (const path of ["/finance", "/finance/fees", "/finance/invoices", "/finance/payments", "/finance/expenses"]) {
    revalidatePath(path);
  }
}

export async function saveFeeStructure(_: FinanceFormState | undefined, formData: FormData): Promise<FinanceFormState> {
  const parsed = feeStructureSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Fee structure form invalid hai." };
  const { supabase, schoolId } = await requireFinanceContext("manage");
  const { error } = await supabase.from("fee_structures").insert({
    school_id: schoolId,
    academic_session_id: parsed.data.academicSessionId,
    class_id: parsed.data.classId,
    fee_type: parsed.data.feeType,
    amount: parsed.data.amount,
    frequency: parsed.data.frequency,
    due_day: parsed.data.dueDay,
    is_optional: Boolean(parsed.data.isOptional),
    is_active: Boolean(parsed.data.isActive ?? true)
  });
  if (error) return { error: error.code === "23505" ? "This class/session fee already exists." : "Fee structure save nahi ho saka." };
  revalidateFinance(); return { success: "Fee structure add ho gaya." };
}

export async function saveInvoice(_: FinanceFormState | undefined, formData: FormData): Promise<FinanceFormState> {
  const parsed = invoiceSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invoice form invalid hai." };
  const { supabase, schoolId, user } = await requireFinanceContext("manage");
  const invoiceNumber = `INV-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const { data: invoice, error: invoiceError } = await supabase.from("fee_invoices").insert({
    school_id: schoolId,
    academic_session_id: parsed.data.academicSessionId,
    student_id: parsed.data.studentId,
    invoice_number: invoiceNumber,
    due_date: parsed.data.dueDate,
    notes: parsed.data.notes || null,
    created_by: user.id,
  }).select("id").single();
  if (invoiceError || !invoice) return { error: "Invoice create nahi ho saka." };

  const selected = parsed.data.feeStructureIds;
  const { data: structures, error: structuresError } = await supabase.from("fee_structures").select("id, amount, fee_type").in("id", selected).eq("school_id", schoolId).eq("is_active", true);
  if (structuresError || structures?.length !== selected.length) {
    const { error: cleanupError } = await supabase.from("fee_invoices").delete().eq("id", invoice.id).eq("school_id", schoolId);
    if (cleanupError) return { error: "Selected fee items could not be verified, and the incomplete invoice could not be removed." };
    return { error: "Selected fee items could not be verified. Refresh the page and try again." };
  }
  const rows = structures.map((row) => ({
    school_id: schoolId,
    invoice_id: invoice.id,
    fee_structure_id: row.id,
    fee_type: row.fee_type,
    description: row.fee_type,
    amount: row.amount,
    is_optional: false,
  }));
  const { error: itemError } = await supabase.from("fee_invoice_items").insert(rows);
  if (itemError) {
    const { error: cleanupError } = await supabase.from("fee_invoices").delete().eq("id", invoice.id).eq("school_id", schoolId);
    if (cleanupError) return { error: "Invoice items could not be added; the incomplete invoice also could not be removed." };
    return { error: "Invoice items create nahi hue." };
  }

  revalidateFinance(); return { success: "Invoice generate ho gaya." };
}

export async function savePayment(_: FinanceFormState | undefined, formData: FormData): Promise<FinanceFormState> {
  const parsed = paymentSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Payment form invalid hai." };
  const { supabase, schoolId, user } = await requireFinanceContext("manage");
  const { data: invoice, error: invoiceError } = await supabase.from("fee_invoices").select("remaining_amount,status").eq("id", parsed.data.invoiceId).eq("school_id", schoolId).maybeSingle();
  if (invoiceError) return { error: "Invoice balance verify nahi ho saka. Dobara try karein." };
  if (!invoice || String(invoice.status) === "cancelled") return { error: "Selected invoice available nahi hai." };
  if (parsed.data.amount > Number(invoice.remaining_amount)) return { error: "Payment amount invoice ke remaining balance se zyada nahi ho sakta." };
  const reference = `PMT-${crypto.randomUUID()}`;
  const { error } = await supabase.from("fee_payments").insert({
    school_id: schoolId,
    invoice_id: parsed.data.invoiceId,
    payment_reference: reference,
    amount: parsed.data.amount,
    payment_method: parsed.data.paymentMethod,
    payment_date: parsed.data.paymentDate,
    received_by: user.id,
    notes: parsed.data.notes || null,
  });
  if (error) return { error: "Payment save nahi ho saka." };
  revalidateFinance(); return { success: "Payment recorded ho gaya." };
}

export async function saveExpense(_: FinanceFormState | undefined, formData: FormData): Promise<FinanceFormState> {
  const parsed = expenseSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Expense form invalid hai." };
  const { supabase, schoolId, user } = await requireFinanceContext("manage", "finance");
  const { error } = await supabase.from("school_expenses").insert({
    school_id: schoolId,
    category: parsed.data.category,
    description: parsed.data.description,
    vendor: parsed.data.vendor || null,
    amount: parsed.data.amount,
    payment_method: parsed.data.paymentMethod,
    expense_date: parsed.data.expenseDate,
    reference: parsed.data.reference || null,
    notes: parsed.data.notes || null,
    created_by: user.id,
  });
  if (error) return { error: "Expense record save nahi ho saka. Check karein ke finance migration apply hai." };
  revalidateFinance();
  return { success: "Expense record save ho gaya." };
}
