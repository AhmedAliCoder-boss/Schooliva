import { InvoiceForm } from "@/components/finance/finance-forms";
import { FinanceFormDisclosure } from "@/components/finance/finance-form-disclosure";
import { InvoiceRegister, type InvoiceRegisterRow, type InvoiceRegisterSession } from "@/components/finance/invoice-register";
import { canManageFinance, requireFinanceContext } from "@/lib/finance/context";
import { formatCurrency } from "@/lib/format/currency";

type Relation<T> = T | T[] | null;
type InvoiceStudent = { first_name: string | null; last_name: string | null; admission_number: string | null; student_identifier: string | null };
type InvoiceSession = { name: string | null };

function relation<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function todayInSchoolTimeZone() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function FinanceInvoicesPage() {
  const { supabase, schoolId } = await requireFinanceContext("view");
  const [{ data: sessions, error: sessionsError }, { data: students, error: studentsError }, { data: structures, error: structuresError }, canManage] = await Promise.all([
    supabase.from("academic_sessions").select("id,name").eq("school_id", schoolId).order("starts_on", { ascending: false }),
    supabase.from("students").select("id,first_name,last_name,student_identifier").eq("school_id", schoolId).eq("status", "active").order("last_name"),
    supabase.from("fee_structures").select("id,fee_type,amount").eq("school_id", schoolId).eq("is_active", true).order("fee_type"),
    canManageFinance(supabase, schoolId),
  ]);
  if (sessionsError || studentsError || structuresError) throw new Error("Invoice workspace data could not be loaded.");
  const studentOptions = (students ?? []).map((student) => ({
    id: String(student.id),
    name: `${[student.first_name, student.last_name].filter(Boolean).join(" ")} (${student.student_identifier ?? "Student ID unavailable"})`,
  }));
  const feeOptions = (structures ?? []).map((row) => ({ id: String(row.id), name: `${row.fee_type} - ${formatCurrency(row.amount)}` }));
  const invoiceRows: InvoiceRegisterRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from("fee_invoices")
      .select("id,invoice_number,student_id,academic_session_id,status,total,paid_amount,remaining_amount,due_date,created_at,students(first_name,last_name,admission_number,student_identifier),academic_sessions(name)")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("Invoice register could not be loaded.", error);
      throw new Error("Invoice register could not be loaded.");
    }
    invoiceRows.push(...(data ?? []).map((invoice) => {
      const student = relation(invoice.students as Relation<InvoiceStudent>);
      const session = relation(invoice.academic_sessions as Relation<InvoiceSession>);
      return {
        id: String(invoice.id),
        invoiceNumber: String(invoice.invoice_number),
        studentName: [student?.first_name, student?.last_name].filter(Boolean).join(" ") || "Student",
        admissionNumber: student?.admission_number ?? "",
        studentIdentifier: student?.student_identifier ?? "",
        sessionId: String(invoice.academic_session_id),
        sessionName: session?.name ?? "",
        dueDate: String(invoice.due_date),
        total: Number(invoice.total ?? 0),
        paidAmount: Number(invoice.paid_amount ?? 0),
        remainingAmount: Number(invoice.remaining_amount ?? 0),
        status: String(invoice.status),
        createdAt: String(invoice.created_at),
      };
    }));
    if ((data?.length ?? 0) < pageSize) break;
  }
  const sessionOptions: InvoiceRegisterSession[] = (sessions ?? []).map((session) => ({
    id: String(session.id),
    name: String(session.name),
  }));
  const defaultSessionId = sessionOptions[0]?.id ?? "";

  return <main className="students-shell finance-shell">
    <section className="module-page-header"><div className="module-page-header__row"><div>
      <p className="module-page-header__eyebrow">Finance / Billing</p><h1>Invoices</h1>
      <p>Create student bills from active fee structures and track outstanding balances.</p>
    </div></div></section>
    <section className="finance-work-grid">
      {canManage && <FinanceFormDisclosure label="Billing" title="Create invoice" description="Choose a student, academic session, and fee items.">
        <InvoiceForm sessions={sessionOptions} students={studentOptions} feeStructures={feeOptions} defaultSessionId={defaultSessionId} />
      </FinanceFormDisclosure>}
      <InvoiceRegister invoices={invoiceRows} sessions={sessionOptions} today={todayInSchoolTimeZone()} />
    </section>
  </main>;
}
