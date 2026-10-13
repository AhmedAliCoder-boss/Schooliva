"use server";

import { revalidatePath } from "next/cache";
import { requireFinanceContext } from "@/lib/finance/context";
import { formatInvoiceNumber } from "@/lib/finance/invoice-number";
import {
  expenseSchema,
  feeStructureDeleteSchema,
  feeStructureSchema,
  feeStructureStatusSchema,
  invoiceSchema,
  paymentSchema,
  type FinanceFormState,
} from "@/lib/finance/schemas";

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

export async function setFeeStructureActive(_: FinanceFormState | undefined, formData: FormData): Promise<FinanceFormState> {
  const parsed = feeStructureStatusSchema.safeParse({
    feeStructureId: formData.get("feeStructureId"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return { error: "Fee structure status input is invalid." };
  const { supabase, schoolId } = await requireFinanceContext("manage");
  const { data, error } = await supabase.from("fee_structures")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.feeStructureId)
    .eq("school_id", schoolId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Fee structure status could not be updated.", error);
    return { error: "Fee structure status could not be updated." };
  }
  if (!data) return { error: "Fee structure was not found in this school." };
  revalidateFinance();
  return { success: `Fee structure ${parsed.data.isActive ? "activated" : "deactivated"}.` };
}

export async function deleteFeeStructure(_: FinanceFormState | undefined, formData: FormData): Promise<FinanceFormState> {
  const parsed = feeStructureDeleteSchema.safeParse({ feeStructureId: formData.get("feeStructureId") });
  if (!parsed.success) return { error: "Fee structure ID is invalid." };
  const { supabase, schoolId } = await requireFinanceContext("manage");
  const { count, error: usageError } = await supabase.from("fee_invoice_items")
    .select("id", { count: "exact", head: true })
    .eq("fee_structure_id", parsed.data.feeStructureId)
    .eq("school_id", schoolId);
  if (usageError) {
    console.error("Fee structure invoice usage could not be checked.", usageError);
    return { error: "Fee structure usage could not be verified. Please try again." };
  }
  if (count) return { error: "This fee structure is used on an invoice. Deactivate it instead of removing it." };

  const { data, error } = await supabase.from("fee_structures")
    .delete()
    .eq("id", parsed.data.feeStructureId)
    .eq("school_id", schoolId)
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23503") {
      return { error: "This fee structure is used on an invoice. Deactivate it instead of removing it." };
    }
    console.error("Fee structure could not be removed.", error);
    return { error: "Fee structure could not be removed." };
  }
  if (!data) return { error: "Fee structure was not found in this school." };
  revalidateFinance();
  return { success: "Fee structure removed." };
}

export async function saveInvoice(_: FinanceFormState | undefined, formData: FormData): Promise<FinanceFormState> {
  const parsed = invoiceSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invoice form invalid hai." };
  const { supabase, schoolId, user } = await requireFinanceContext("manage");
  const selected = parsed.data.feeStructureIds;
  const [{ data: sessions, error: sessionsError }, { data: structures, error: structuresError }] = await Promise.all([
    supabase.from("academic_sessions")
      .select("id,status,is_current")
      .eq("school_id", schoolId)
      .order("starts_on", { ascending: false }),
    supabase.from("fee_structures")
      .select("id,academic_session_id,amount,fee_type")
      .in("id", selected)
      .eq("school_id", schoolId)
      .eq("is_active", true),
  ]);
  if (sessionsError || structuresError) {
    console.error("Invoice session or fee items could not be verified.", { sessionsError, structuresError });
    return { error: "Invoice session or fee items could not be verified." };
  }
  if (structures?.length !== selected.length) {
    return { error: "Selected fee items could not be verified. Refresh the page and try again." };
  }

  const requestedSession = sessions?.find((session) => session.id === parsed.data.academicSessionId);
  const structureSessionIds = new Set((structures ?? []).map((structure) => String(structure.academic_session_id)));
  const inferredStructureSession = structureSessionIds.size === 1
    ? [...structureSessionIds][0]
    : null;
  const invoiceSession = requestedSession
    ?? sessions?.find((session) => session.is_current)
    ?? sessions?.find((session) => session.status === "active" && session.id === inferredStructureSession)
    ?? sessions?.find((session) => session.status === "active")
    ?? (sessions?.length === 1 ? sessions[0] : undefined);
  if (!invoiceSession) return { error: "Create or activate an academic session before creating an invoice." };
  if ([...structureSessionIds].some((id) => id !== invoiceSession.id)) {
    return { error: "Selected fee items belong to a different academic session. Select the matching session and try again." };
  }

  const { data: invoiceSequence, error: sequenceError } = await supabase.rpc("next_fee_invoice_number", {
    target_school_id: schoolId,
  });
  if (sequenceError) {
    console.error("Invoice number could not be generated.", sequenceError);
    return { error: "Invoice number could not be generated. Please try again." };
  }

  let invoiceNumber: string;
  try {
    invoiceNumber = formatInvoiceNumber(invoiceSequence);
  } catch (error) {
    console.error("Invoice number sequence returned an invalid value.", error);
    return { error: "Invoice number could not be generated. Please contact support." };
  }
  const { data: invoice, error: invoiceError } = await supabase.from("fee_invoices").insert({
    school_id: schoolId,
    academic_session_id: invoiceSession.id,
    student_id: parsed.data.studentId,
    invoice_number: invoiceNumber,
    due_date: parsed.data.dueDate,
    notes: parsed.data.notes || null,
    created_by: user.id,
  }).select("id").single();
  if (invoiceError || !invoice) return { error: "Invoice create nahi ho saka." };

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
