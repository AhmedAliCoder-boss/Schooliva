import Link from "next/link";
import { redirect } from "next/navigation";

import { LeaveRequestForm, LeaveTypeForm } from "@/components/leave/leave-forms";
import { LeaveRegister, type LeaveRegisterRow } from "@/components/leave/leave-register";
import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { requireUser } from "@/lib/auth/authorization";

type RelationName = { name?: string | null };
type PersonRelation = {
  first_name?: string | null;
  last_name?: string | null;
  student_identifier?: string | null;
  employee_code?: string | null;
};

function relation<T>(value: unknown): T | null {
  return Array.isArray(value) ? (value[0] as T | undefined) ?? null : (value as T | null);
}

function currentDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function LeavePage() {
  const current = await requireUser();
  const { schoolId, isMasterAdmin } = await getActiveSchoolContext(current.supabase, current.user.id);
  if (!schoolId) redirect(isMasterAdmin ? "/admin" : "/setup?onboarding=1");

  const supabase = current.supabase;
  const [
    { data: types, error: typesError },
    { data: requests, error: requestsError },
    { data: students, error: studentsError },
    { data: teachers, error: teachersError },
    { data: staff, error: staffError },
  ] = await Promise.all([
    supabase.from("leave_types").select("id,name").eq("school_id", schoolId).eq("is_active", true).order("name"),
    supabase.from("leave_requests")
      .select("id,status,start_date,end_date,reason,approver_note,created_at,student_id,teacher_id,staff_id,attachment_path,leave_types(name),students(first_name,last_name,admission_number),teachers(first_name,last_name,employee_code),staff(first_name,last_name,employee_code)")
      .eq("school_id", schoolId).order("created_at", { ascending: false }).limit(1000),
    supabase.from("students").select("id,first_name,last_name,student_identifier").eq("school_id", schoolId).eq("is_active", true).order("last_name").limit(1000),
    supabase.from("teachers").select("id,first_name,last_name,employee_code").eq("school_id", schoolId).eq("employment_status", "active").order("last_name").limit(500),
    supabase.from("staff").select("id,first_name,last_name,employee_code").eq("school_id", schoolId).eq("employment_status", "active").order("last_name").limit(500),
  ]);
  if (typesError || requestsError || studentsError || teachersError || staffError) {
    console.error("Leave management data could not be loaded.", { typesError, requestsError, studentsError, teachersError, staffError });
    throw new Error("Leave management data could not be loaded.");
  }

  const studentOptions = (students ?? []).map((item) => ({
    id: String(item.id),
    name: `${item.first_name ?? ""} ${item.last_name ?? ""} · Student ID: ${item.student_identifier ?? "Not assigned"}`.trim(),
  }));
  const teacherOptions = (teachers ?? []).map((item) => ({
    id: String(item.id),
    name: `${item.first_name ?? ""} ${item.last_name ?? ""} · ${item.employee_code ?? "Teacher"}`.trim(),
  }));
  const staffOptions = (staff ?? []).map((item) => ({
    id: String(item.id),
    name: `${item.first_name ?? ""} ${item.last_name ?? ""} · ${item.employee_code ?? "Staff"}`.trim(),
  }));

  const requestRows: LeaveRegisterRow[] = await Promise.all((requests ?? []).map(async (request) => {
    const student = relation<PersonRelation>(request.students);
    const teacher = relation<PersonRelation>(request.teachers);
    const staffMember = relation<PersonRelation>(request.staff);
    const person = student ?? teacher ?? staffMember;
    const personType = request.student_id ? "student" : request.teacher_id ? "teacher" : "staff";
    const personName = `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim() || "Unknown person";
    const typeRelation = relation<RelationName>(request.leave_types);
    let attachmentUrl: string | null = null;
    if (request.attachment_path) {
      const { data, error } = await supabase.storage.from("leave-attachments").createSignedUrl(request.attachment_path, 600);
      if (error || !data?.signedUrl) {
        console.error("Leave attachment link could not be generated.", error);
        throw new Error("Leave attachment could not be opened.");
      }
      attachmentUrl = data.signedUrl;
    }
    return {
      id: request.id,
      status: request.status,
      startDate: request.start_date,
      endDate: request.end_date,
      reason: request.reason,
      approverNote: request.approver_note,
      leaveType: typeRelation?.name ?? "Leave",
      personName,
      personId: personType === "student" ? person?.student_identifier ?? "" : person?.employee_code ?? "",
      personType,
      createdAt: request.created_at,
      attachmentUrl,
    };
  }));

  const today = currentDate();
  const approvedPeopleLeaves = requestRows.filter((row) =>
    row.status === "approved" && row.personType !== "student" && row.startDate <= today && row.endDate >= today
  ).length;
  const summary = {
    requested: requestRows.filter((row) => row.status === "requested").length,
    approved: requestRows.filter((row) => row.status === "approved").length,
    rejected: requestRows.filter((row) => row.status === "rejected").length,
    completed: requestRows.filter((row) => row.status === "completed").length,
  };

  return <main className="students-shell leave-shell">
    <header className="students-header">
      <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
      <div><Link className="text-action" href="/people-attendance">People attendance register →</Link><Link className="text-action students-header-link" href="/dashboard">Dashboard →</Link></div>
    </header>
    <section className="module-page-header">
      <div className="module-page-header__row"><div>
        <p className="module-page-header__eyebrow">People operations / Leave register</p>
        <h1>Leave management.</h1>
        <p>Track requests, approvals, employee coverage, and approved leave against the daily attendance register.</p>
      </div></div>
    </section>
    <section className="module-kpi-grid leave-metrics" aria-label="Leave overview">
      <article className="module-kpi"><span>Awaiting decision</span><strong>{summary.requested}</strong></article>
      <article className="module-kpi"><span>Approved</span><strong>{summary.approved}</strong></article>
      <article className="module-kpi"><span>Rejected</span><strong>{summary.rejected}</strong></article>
      <article className="module-kpi"><span>Completed</span><strong>{summary.completed}</strong></article>
      <article className="module-kpi"><span>People on leave today</span><strong>{approvedPeopleLeaves}</strong><small>Attendance defaults to Excused</small></article>
    </section>

    <div className="leave-admin-grid">
      <details className="leave-collapsible">
        <summary><span><strong>Leave types</strong><small>Configure the leave categories available to your school.</small></span><span className="leave-collapsible__toggle">Manage</span></summary>
        <div className="leave-collapsible__body"><LeaveTypeForm /></div>
      </details>
      <details className="leave-collapsible leave-collapsible--request">
        <summary><span><strong>Submit a leave request</strong><small>Search for a student or employee, choose dates, and provide a reason.</small></span><span className="leave-collapsible__toggle">New request</span></summary>
        <div className="leave-collapsible__body">
          <LeaveRequestForm types={(types ?? []).map((item) => ({ id: item.id, name: item.name }))}
            students={studentOptions} teachers={teacherOptions} staff={staffOptions} />
        </div>
      </details>
    </div>

    <LeaveRegister rows={requestRows} today={today} />
  </main>;
}
