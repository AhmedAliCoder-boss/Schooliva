import { InvoiceForm } from "@/components/finance/finance-forms";
import { ManagementInvoiceForm, ManagementInvoiceRegister, ScheduledInvoicePanel, type ManagementInvoiceRow, type StudentInvoiceScheduleRow } from "@/components/finance/invoice-automation";
import { FinanceFormDisclosure } from "@/components/finance/finance-form-disclosure";
import { InvoiceRegister, type InvoiceRegisterRow, type InvoiceRegisterSession } from "@/components/finance/invoice-register";
import { canManageFinance, requireFinanceContext } from "@/lib/finance/context";
import { formatCurrency } from "@/lib/format/currency";

type Relation<T> = T | T[] | null;
type InvoiceStudent = { first_name: string | null; last_name: string | null; admission_number: string | null; student_identifier: string | null };
type InvoiceSession = { name: string | null };
type NamedRelation = { name: string | null };

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
  const [
    { data: sessions, error: sessionsError },
    { data: students, error: studentsError },
    { data: structures, error: structuresError },
    { data: enrollments, error: enrollmentsError },
    { data: schedules, error: schedulesError },
    { data: managementData, error: managementError },
    canManage,
  ] = await Promise.all([
    supabase.from("academic_sessions").select("id,name,status,is_current").eq("school_id", schoolId).order("starts_on", { ascending: false }),
    supabase.from("students").select("id,first_name,last_name,student_identifier,admission_number,admission_date").eq("school_id", schoolId).eq("status", "active").eq("is_active", true).order("last_name"),
    supabase.from("fee_structures").select("id,fee_type,amount,academic_session_id,class_id,frequency,classes(name)").eq("school_id", schoolId).eq("is_active", true).order("fee_type"),
    supabase.from("student_enrollments").select("student_id,academic_session_id,class_id,section_id,classes(name),sections(name)").eq("school_id", schoolId),
    supabase.from("student_invoice_schedules").select("id,student_id,frequency,next_invoice_date,is_active,students(first_name,last_name)").eq("school_id", schoolId).order("next_invoice_date"),
    supabase.from("management_invoices").select("id,invoice_number,recipient_name,due_date,subtotal,status").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(1000),
    canManageFinance(supabase, schoolId),
  ]);
  if (sessionsError || studentsError || structuresError || enrollmentsError || schedulesError || managementError) {
    console.error("Invoice workspace data could not be loaded.", { sessionsError, studentsError, structuresError, enrollmentsError, schedulesError, managementError });
    throw new Error("Invoice workspace data could not be loaded.");
  }
  const studentOptions = (students ?? []).map((student) => ({
    id: String(student.id),
    name: `${[student.first_name, student.last_name].filter(Boolean).join(" ")} (${student.student_identifier ?? "Student ID unavailable"})`,
    searchText: `${student.student_identifier ?? ""} ${student.admission_number ?? ""}`,
  }));
  const scheduleStudentOptions = (students ?? []).filter((student) => student.admission_date).map((student) => ({
    id: String(student.id),
    name: `${[student.first_name, student.last_name].filter(Boolean).join(" ")} · joined ${student.admission_date}`,
    searchText: `${student.student_identifier ?? ""} ${student.admission_number ?? ""}`,
  }));
  const feeOptions = (structures ?? []).filter((row) => row.frequency !== "one_time").map((row) => {
    const classRecord = relation(row.classes as Relation<NamedRelation>);
    return {
      id: String(row.id),
      name: `${classRecord?.name ?? "Class"} · ${row.fee_type} · ${formatCurrency(row.amount)}`,
      sessionId: String(row.academic_session_id),
      classId: String(row.class_id),
    };
  });
  const sessionOptions: InvoiceRegisterSession[] = (sessions ?? []).map((session) => ({
    id: String(session.id),
    name: String(session.name),
  }));
  const scheduleSessionOptions = (sessions ?? [])
    .filter((session) => session.status === "active" || session.is_current)
    .map((session) => ({ id: String(session.id), name: String(session.name) }));
  const enrollmentsByStudentSession = new Map((enrollments ?? []).map((enrollment) => {
    const classRecord = relation(enrollment.classes as Relation<NamedRelation>);
    const sectionRecord = relation(enrollment.sections as Relation<NamedRelation>);
    return [`${enrollment.student_id}:${enrollment.academic_session_id}`, {
      className: classRecord?.name ?? "",
      sectionName: sectionRecord?.name ?? "",
    }];
  }));
  const scheduleRows: StudentInvoiceScheduleRow[] = (schedules ?? []).map((schedule) => {
    const student = relation(schedule.students as Relation<InvoiceStudent>);
    return {
      id: String(schedule.id),
      studentName: [student?.first_name, student?.last_name].filter(Boolean).join(" ") || "Student",
      frequency: String(schedule.frequency),
      nextInvoiceDate: String(schedule.next_invoice_date),
      isActive: Boolean(schedule.is_active),
    };
  });
  const managementInvoices: ManagementInvoiceRow[] = (managementData ?? []).map((invoice) => ({
    id: String(invoice.id),
    invoiceNumber: String(invoice.invoice_number),
    recipientName: String(invoice.recipient_name),
    dueDate: String(invoice.due_date),
    total: Number(invoice.subtotal ?? 0),
    status: invoice.status === "unpaid" && String(invoice.due_date) < todayInSchoolTimeZone() ? "overdue" : String(invoice.status),
  }));
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
        studentId: String(invoice.student_id),
        invoiceNumber: String(invoice.invoice_number),
        studentName: [student?.first_name, student?.last_name].filter(Boolean).join(" ") || "Student",
        admissionNumber: student?.admission_number ?? "",
        studentIdentifier: student?.student_identifier ?? "",
        className: enrollmentsByStudentSession.get(`${invoice.student_id}:${invoice.academic_session_id}`)?.className ?? "",
        sectionName: enrollmentsByStudentSession.get(`${invoice.student_id}:${invoice.academic_session_id}`)?.sectionName ?? "",
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
  const defaultSessionId = sessionOptions[0]?.id ?? "";

  return <main className="students-shell finance-shell">
    <section className="module-page-header"><div className="module-page-header__row"><div>
      <p className="module-page-header__eyebrow">Finance / Billing</p><h1>Invoices</h1>
      <p>Create student bills, automate recurring schedules, and manage general invoices separately.</p>
    </div></div></section>
    <section className="finance-work-grid">
      {canManage && <FinanceFormDisclosure label="Billing" title="Create invoice" description="Choose a student, academic session, and fee items.">
        <InvoiceForm sessions={sessionOptions} students={studentOptions} feeStructures={feeOptions} defaultSessionId={defaultSessionId} />
      </FinanceFormDisclosure>}
      <ScheduledInvoicePanel
        students={scheduleStudentOptions}
        sessions={scheduleSessionOptions}
        feeStructures={feeOptions}
        schedules={scheduleRows}
        canManage={canManage}
      />
      <InvoiceRegister invoices={invoiceRows} sessions={sessionOptions} today={todayInSchoolTimeZone()} />
      {canManage && <FinanceFormDisclosure label="Management billing" title="Create general invoice" description="Bill a non-student recipient with one or more itemized charges.">
        <ManagementInvoiceForm />
      </FinanceFormDisclosure>}
      <ManagementInvoiceRegister invoices={managementInvoices} />
    </section>
  </main>;
}
