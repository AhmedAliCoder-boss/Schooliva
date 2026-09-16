"use server";

import { revalidatePath } from "next/cache";
import { requireFinanceContext } from "@/lib/finance/context";
import { feeStructureSchema, invoiceSchema, paymentSchema, type FinanceFormState } from "@/lib/finance/schemas";

function values(formData: FormData) { return Object.fromEntries(formData.entries()); }

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
  revalidatePath("/finance"); return { success: "Fee structure add ho gaya." };
}

export async function saveInvoice(_: FinanceFormState | undefined, formData: FormData): Promise<FinanceFormState> {
  const parsed = invoiceSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invoice form invalid hai." };
  const { supabase, schoolId, user } = await requireFinanceContext("manage");
  const invoiceNumber = `INV-${Date.now()}`;
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

  const selected = Array.isArray(parsed.data.feeStructureIds) ? parsed.data.feeStructureIds : [];
  if (selected.length) {
    const { data: structures } = await supabase.from("fee_structures").select("id, amount, fee_type").in("id", selected).eq("school_id", schoolId);
    const rows = (structures ?? []).map((row) => ({
      school_id: schoolId,
      invoice_id: invoice.id,
      fee_structure_id: row.id,
      fee_type: row.fee_type,
      description: row.fee_type,
      amount: row.amount,
      is_optional: false,
    }));
    const { error: itemError } = await supabase.from("fee_invoice_items").insert(rows);
    if (itemError) return { error: "Invoice items create nahi hue." };
  }

  revalidatePath("/finance"); revalidatePath("/finance/invoices"); return { success: "Invoice generate ho gaya." };
}

export async function savePayment(_: FinanceFormState | undefined, formData: FormData): Promise<FinanceFormState> {
  const parsed = paymentSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Payment form invalid hai." };
  const { supabase, schoolId, user } = await requireFinanceContext("manage");
  const reference = `PMT-${Date.now()}`;
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
  revalidatePath("/finance"); revalidatePath("/finance/invoices"); return { success: "Payment recorded ho gaya." };
}
