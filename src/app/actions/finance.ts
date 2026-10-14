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
  managementInvoiceSchema,
  paymentSchema,
  studentInvoiceScheduleSchema,
  studentInvoiceScheduleStatusSchema,
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
  const classIds = parsed.data.classId === "all"
    ? (await supabase.from("classes").select("id").eq("school_id", schoolId))
    : { data: [{ id: parsed.data.classId }], error: null };
  if (classIds.error) {
    console.error("Fee structure target classes could not be loaded.", classIds.error);
    return { error: "Classes could not be loaded for the fee structure." };
  }
  if (!classIds.data?.length) return { error: "Create at least one class before adding a fee structure." };

  const rows = classIds.data.map((classRow) => ({
    school_id: schoolId,
    academic_session_id: parsed.data.academicSessionId,
    class_id: classRow.id,
    fee_type: parsed.data.feeType,
    amount: parsed.data.amount,
    frequency: parsed.data.frequency,
    due_day: parsed.data.dueDay,
    is_optional: Boolean(parsed.data.isOptional),
    is_active: Boolean(parsed.data.isActive ?? true),
  }));
  const { data, error } = await supabase.from("fee_structures")
    .upsert(rows, {
      onConflict: "school_id,academic_session_id,class_id,fee_type",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) {
    console.error("Fee structure could not be saved for selected classes.", error);
    return { error: error.code === "23505" ? "This class/session fee already exists." : "Fee structure save nahi ho saka." };
  }
  if (!data?.length) return { error: "This fee structure already exists for every selected class." };
  revalidateFinance();
  return { success: parsed.data.classId === "all"
    ? `Fee structure added to ${data.length} class${data.length === 1 ? "" : "es"}. Existing duplicate class fees were skipped.`
    : "Fee structure add ho gaya." };
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

export async function saveStudentInvoiceSchedule(_: FinanceFormState | undefined, formData: FormData): Promise<FinanceFormState> {
  const parsed = studentInvoiceScheduleSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invoice schedule form invalid hai." };
  const { supabase, schoolId, user } = await requireFinanceContext("manage");
  const [{ data: student, error: studentError }, { data: session, error: sessionError }] = await Promise.all([
    supabase.from("students")
      .select("id,admission_date")
      .eq("id", parsed.data.studentId)
      .eq("school_id", schoolId)
      .eq("status", "active")
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("academic_sessions")
      .select("id,status,is_current")
      .eq("id", parsed.data.academicSessionId)
      .eq("school_id", schoolId)
      .maybeSingle(),
  ]);
  if (studentError || sessionError) {
    console.error("Invoice schedule student or academic session could not be verified.", { studentError, sessionError });
    return { error: "Student or academic session could not be verified." };
  }
  if (!student?.admission_date) return { error: "Student admission/joining date is required to anchor invoice generation." };
  if (!session || (session.status !== "active" && !session.is_current)) return { error: "Select an active academic session." };

  const { data: enrollment, error: enrollmentError } = await supabase.from("student_enrollments")
    .select("class_id")
    .eq("school_id", schoolId)
    .eq("student_id", student.id)
    .eq("academic_session_id", session.id)
    .eq("status", "active")
    .maybeSingle();
  if (enrollmentError) {
    console.error("Invoice schedule enrollment could not be verified.", enrollmentError);
    return { error: "Student class enrollment could not be verified." };
  }
  if (!enrollment) return { error: "Student must have an active enrollment in the selected academic session." };

  const selectedIds = parsed.data.feeStructureIds;
  const { data: structures, error: structuresError } = await supabase.from("fee_structures")
    .select("id,frequency")
    .in("id", selectedIds)
    .eq("school_id", schoolId)
    .eq("academic_session_id", session.id)
    .eq("class_id", enrollment.class_id)
    .eq("is_active", true);
  if (structuresError) {
    console.error("Invoice schedule fee items could not be verified.", structuresError);
    return { error: "Selected fee items could not be verified." };
  }
  if (structures?.length !== selectedIds.length || structures.some((item) => item.frequency === "one_time")) {
    return { error: "Choose only active recurring fee items for the student's enrolled class and session." };
  }

  const { data: schedule, error: scheduleError } = await supabase.from("student_invoice_schedules").insert({
    school_id: schoolId,
    student_id: student.id,
    academic_session_id: session.id,
    fee_structure_ids: selectedIds,
    frequency: parsed.data.frequency,
    anchor_date: student.admission_date,
    next_invoice_date: student.admission_date,
    created_by: user.id,
  }).select("id").single();
  if (scheduleError || !schedule) {
    if (scheduleError?.code === "23505") return { error: "This student already has a schedule for the selected academic session." };
    console.error("Student invoice schedule could not be saved.", scheduleError);
    return { error: "Student invoice schedule could not be saved." };
  }

  const { data: generatedCount, error: generationError } = await supabase.rpc("generate_student_scheduled_invoices", {
    target_school_id: schoolId,
  });
  if (generationError) {
    console.error("Catch-up invoices could not be generated for the new schedule.", generationError);
    const { error: cleanupError } = await supabase.from("student_invoice_schedules")
      .delete()
      .eq("id", schedule.id)
      .eq("school_id", schoolId);
    if (cleanupError) {
      console.error("Failed schedule could not be removed after invoice generation failed.", cleanupError);
      return { error: "Invoice generation failed and the schedule could not be rolled back. Contact finance support." };
    }
    return { error: "Schedule was not activated because catch-up invoices could not be generated." };
  }
  revalidateFinance();
  const count = Number(generatedCount ?? 0);
  return { success: `Invoice schedule activated; ${count} due invoice${count === 1 ? "" : "s"} generated from the student's joining date.` };
}

export async function generateScheduledInvoices(state: FinanceFormState | undefined, formData: FormData): Promise<FinanceFormState> {
  void state;
  void formData;
  const { supabase, schoolId } = await requireFinanceContext("manage");
  const { data, error } = await supabase.rpc("generate_student_scheduled_invoices", { target_school_id: schoolId });
  if (error) {
    console.error("Due student invoices could not be generated.", error);
    return { error: "Due scheduled invoices could not be generated. Check active fee items and try again." };
  }
  revalidateFinance();
  const count = Number(data ?? 0);
  return { success: `${count} due scheduled invoice${count === 1 ? "" : "s"} generated.` };
}

export async function setStudentInvoiceScheduleActive(_: FinanceFormState | undefined, formData: FormData): Promise<FinanceFormState> {
  const parsed = studentInvoiceScheduleStatusSchema.safeParse({
    scheduleId: formData.get("scheduleId"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return { error: "Invoice schedule status input is invalid." };
  const { supabase, schoolId } = await requireFinanceContext("manage");
  const { data, error } = await supabase.from("student_invoice_schedules")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.scheduleId)
    .eq("school_id", schoolId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Student invoice schedule status could not be updated.", error);
    return { error: "Invoice schedule status could not be updated." };
  }
  if (!data) return { error: "Invoice schedule was not found in this school." };
  revalidateFinance();
  return { success: `Invoice schedule ${parsed.data.isActive ? "activated" : "paused"}.` };
}

export async function saveManagementInvoice(_: FinanceFormState | undefined, formData: FormData): Promise<FinanceFormState> {
  const parsed = managementInvoiceSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Management invoice form invalid hai." };
  const { supabase, schoolId, user } = await requireFinanceContext("manage");
  const { data: invoiceSequence, error: sequenceError } = await supabase.rpc("next_fee_invoice_number", {
    target_school_id: schoolId,
  });
  if (sequenceError) {
    console.error("Management invoice number could not be generated.", sequenceError);
    return { error: "Invoice number could not be generated. Please try again." };
  }
  let invoiceNumber: string;
  try {
    invoiceNumber = formatInvoiceNumber(invoiceSequence);
  } catch (error) {
    console.error("Management invoice sequence returned an invalid value.", error);
    return { error: "Invoice number could not be generated. Please contact support." };
  }

  const items = parsed.data.itemDescription.map((description, index) => {
    const quantity = parsed.data.itemQuantity[index];
    const unitPrice = parsed.data.itemUnitPrice[index];
    return { description, quantity, unitPrice, amount: Math.round(quantity * unitPrice * 100) / 100 };
  });
  const total = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  const { data: invoice, error: invoiceError } = await supabase.from("management_invoices").insert({
    school_id: schoolId,
    invoice_number: invoiceNumber,
    recipient_name: parsed.data.recipientName,
    recipient_email: parsed.data.recipientEmail || null,
    recipient_phone: parsed.data.recipientPhone || null,
    due_date: parsed.data.dueDate,
    subtotal: total,
    remaining_amount: total,
    status: "unpaid",
    notes: parsed.data.notes || null,
    created_by: user.id,
  }).select("id").single();
  if (invoiceError || !invoice) {
    console.error("Management invoice could not be created.", invoiceError);
    return { error: "Management invoice could not be created." };
  }
  const { error: itemsError } = await supabase.from("management_invoice_items").insert(items.map((item) => ({
    school_id: schoolId,
    invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    amount: item.amount,
  })));
  if (itemsError) {
    console.error("Management invoice line items could not be created.", itemsError);
    const { error: cleanupError } = await supabase.from("management_invoices")
      .delete()
      .eq("id", invoice.id)
      .eq("school_id", schoolId);
    if (cleanupError) {
      console.error("Incomplete management invoice could not be rolled back.", cleanupError);
      return { error: "Invoice items failed to save and the incomplete invoice could not be removed." };
    }
    return { error: "Management invoice items could not be saved." };
  }
  revalidateFinance();
  return { success: `Management invoice ${invoiceNumber} created.` };
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
