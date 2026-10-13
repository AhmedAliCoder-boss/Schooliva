import Link from "next/link";
import { redirect } from "next/navigation";

import { HrmLocalDateTime } from "@/components/hrm/hrm-forms";
import { EmployeeDetails, EmployeeExitRequestForm, EmployeeExitReviewForm, type ExitEmployeeOption, type ExitRequest } from "@/components/hrm/employee-exit-workflow";
import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { requireUser } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ExitRecordRow = {
  id: string;
  employee_type: "teacher" | "staff";
  action_type: "resignation" | "termination" | "warning";
  teacher_id: string | null;
  staff_id: string | null;
  terminated_on: string;
  reason: string;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_by: string;
  decision_by: string | null;
  decision_at: string | null;
  decision_notes: string | null;
  resignation_file_path: string | null;
  created_at: string;
};

type EmployeeRow = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  joining_date: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  qualification?: string | null;
  address?: string | null;
  employment_status: string;
  photo_path?: string | null;
  department?: string | null;
  specialization?: string | null;
  designation?: string | null;
};

export default async function HrmEmployeeExitsPage() {
  const current = await requireUser();
  const { schoolId, isMasterAdmin } = await getActiveSchoolContext(current.supabase, current.user.id);
  if (!schoolId) redirect(isMasterAdmin ? "/admin" : "/setup?onboarding=1");

  const supabase = current.supabase;
  const [
    { data: canViewRecruitment, error: viewError },
    { data: canManageRecruitment, error: manageError },
    { data: canReview, error: reviewerError },
    { data: canManageTeachers, error: teacherPermissionError },
    { data: canManageStaff, error: staffPermissionError },
    { data: canViewTeachers, error: teacherViewError },
    { data: canViewStaff, error: staffViewError },
  ] = await Promise.all([
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "recruitment", target_action: "view" }),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "recruitment", target_action: "manage" }),
    supabase.rpc("can_review_hrm_employee_exit", { p_school_id: schoolId }),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "teachers", target_action: "manage" }),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "staff", target_action: "manage" }),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "teachers", target_action: "view" }),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "staff", target_action: "view" }),
  ]);
  if (viewError || manageError || reviewerError || teacherPermissionError || staffPermissionError || teacherViewError || staffViewError) {
    throw new Error("Employee exit workflow permissions could not be verified.");
  }
  const canSeeWorkflow = canViewRecruitment || canManageRecruitment || canReview || isMasterAdmin;
  if (!canSeeWorkflow) redirect("/dashboard?error=not-authorized");

  const [exitResult, teachersResult, staffResult] = await Promise.all([
    supabase.from("hrm_employee_terminations")
      .select("id,employee_type,action_type,teacher_id,staff_id,terminated_on,reason,notes,status,submitted_by,decision_by,decision_at,decision_notes,resignation_file_path,created_at")
      .eq("school_id", schoolId).order("created_at", { ascending: false }).limit(500),
    canManageRecruitment && canManageTeachers
      ? supabase.from("teachers").select("id,employee_code,first_name,last_name,email,phone,joining_date,date_of_birth,gender,qualification,address,employment_status,photo_path,specialization")
        .eq("school_id", schoolId).neq("employment_status", "terminated").is("deleted_at", null)
        .order("last_name").limit(500)
      : Promise.resolve({ data: [], error: null }),
    canManageRecruitment && canManageStaff
      ? supabase.from("staff").select("id,employee_code,first_name,last_name,email,phone,joining_date,employment_status,photo_path,department,designation")
        .eq("school_id", schoolId).neq("employment_status", "terminated").is("deleted_at", null)
        .order("last_name").limit(500)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (exitResult.error) throw new Error("Employee exit requests could not be loaded.");
  if (teachersResult.error || staffResult.error) {
    console.error("Active employees could not be loaded for exit requests.", {
      teachersError: teachersResult.error,
      staffError: staffResult.error,
    });
    throw new Error("Active employees could not be loaded for exit requests.");
  }

  const records = (exitResult.data ?? []) as ExitRecordRow[];
  const teacherIds = records.flatMap((record) => record.teacher_id ? [record.teacher_id] : []);
  const staffIds = records.flatMap((record) => record.staff_id ? [record.staff_id] : []);
  const [teacherHistoryResult, staffHistoryResult] = await Promise.all([
    (canManageTeachers || canViewTeachers) && teacherIds.length
      ? supabase.from("teachers").select("id,employee_code,first_name,last_name,email,phone,joining_date,date_of_birth,gender,qualification,address,employment_status,photo_path,specialization").eq("school_id", schoolId).in("id", teacherIds)
      : Promise.resolve({ data: [], error: null }),
    (canManageStaff || canViewStaff) && staffIds.length
      ? supabase.from("staff").select("id,employee_code,first_name,last_name,email,phone,joining_date,employment_status,photo_path,department,designation").eq("school_id", schoolId).in("id", staffIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (teacherHistoryResult.error || staffHistoryResult.error) throw new Error("Employee names could not be loaded for exit history.");

  const employeeById = new Map<string, EmployeeRow>();
  for (const employee of [...(teacherHistoryResult.data ?? []), ...(staffHistoryResult.data ?? [])]) {
    employeeById.set(employee.id, employee);
  }

  const canViewLetters = canManageRecruitment || canReview || isMasterAdmin;
  const hasAccessibleLetters = canViewLetters && records.some((record) => record.resignation_file_path);
  const adminClient = hasAccessibleLetters ? createSupabaseAdminClient() : null;
  if (hasAccessibleLetters && !adminClient) {
    throw new Error("Private employee case documents cannot be viewed without server-side Supabase storage access.");
  }
  const exitRequests: ExitRequest[] = await Promise.all(records.map(async (record) => {
    const employeeId = record.teacher_id ?? record.staff_id ?? "";
    const employee = employeeById.get(employeeId);
    const employeeName = employee ? `${employee.first_name} ${employee.last_name}`.trim() : "Employee";
    const signedUrlResult = record.resignation_file_path && canViewLetters && adminClient
      ? await adminClient.storage.from("employee-resignations").createSignedUrl(record.resignation_file_path, 300)
      : null;
    if (signedUrlResult?.error || (record.resignation_file_path && canViewLetters && !signedUrlResult?.data?.signedUrl)) {
      console.error("A private employee exit document link could not be created.", signedUrlResult?.error);
      throw new Error("An employee case document could not be opened. Refresh and try again.");
    }
    return {
      id: record.id,
      employeeId,
      employeeType: record.employee_type,
      employeeName,
      employeeCode: employee?.employee_code ?? "—",
      employeeRole: employee?.specialization ?? employee?.designation ?? "Employee",
      department: employee?.department ?? (record.employee_type === "teacher" ? "Academics" : null),
      email: employee?.email ?? null,
      phone: employee?.phone ?? null,
      joiningDate: employee?.joining_date ?? null,
      employmentStatus: employee?.employment_status ?? (record.status === "approved" && record.action_type !== "warning" ? "terminated" : "active"),
      idCardHref: `/hrm/employees/${record.employee_type}/${employeeId}/id-card`,
      actionType: record.action_type,
      terminatedOn: record.terminated_on,
      createdAt: record.created_at,
      decisionAt: record.decision_at,
      reason: record.reason,
      notes: record.notes,
      status: record.status,
      decisionNotes: record.decision_notes,
      resignationLetterUrl: signedUrlResult?.data?.signedUrl ?? null,
    };
  }));

  const employees: ExitEmployeeOption[] = [
    ...(teachersResult.data ?? []).map((employee) => ({
      ...employee,
      type: "teacher" as const,
      role: employee.specialization ?? "Teacher",
      department: "Academics",
      idCardHref: `/hrm/employees/teacher/${employee.id}/id-card`,
    })),
    ...(staffResult.data ?? []).map((employee) => ({
      ...employee,
      type: "staff" as const,
      role: employee.designation ?? "Staff",
      department: employee.department ?? null,
      date_of_birth: null,
      gender: null,
      qualification: null,
      address: null,
      idCardHref: `/hrm/employees/staff/${employee.id}/id-card`,
    })),
  ].sort((left, right) => left.last_name.localeCompare(right.last_name) || left.first_name.localeCompare(right.first_name));
  const pendingRequests = exitRequests.filter((request) => request.status === "pending");
  const completedRequests = exitRequests.filter((request) => request.status !== "pending");

  return <main className="students-shell hrm-shell">
    <section className="module-page-header">
      <div className="module-page-header__row">
        <div>
          <p className="module-page-header__eyebrow">HRM / Employee lifecycle</p>
          <h1>Employee exits &amp; cases.</h1>
          <p>Review employee records and ID cards before processing resignations, terminations, and formal warnings.</p>
        </div>
        <Link className="student-primary-action" href="/hrm/employees">Employee records <span aria-hidden="true">→</span></Link>
      </div>
    </section>

    {canManageRecruitment && employees.length > 0 && <EmployeeExitRequestForm employees={employees} />}

    <section className="hrm-exit-list-section">
      <div className="student-panel-heading"><h2>Pending approval</h2><span>{pendingRequests.length} requests</span></div>
      {pendingRequests.length ? <div className="hrm-exit-request-list">
        {pendingRequests.map((request) => <article className="hrm-exit-request" key={request.id}>
          <header>
            <div><h3>{request.employeeName}</h3><p>{request.actionType === "resignation" ? "Resignation" : request.actionType === "termination" ? "Termination" : "Formal warning"} · Effective / issued {request.terminatedOn} · Submitted <HrmLocalDateTime value={request.createdAt} /></p></div>
            <span className="status-pill pending">Pending approval</span>
          </header>
          <EmployeeDetails employee={request} />
          <dl className="hrm-termination-details">
            <div><dt>Reason</dt><dd>{request.reason}</dd></div>
            {request.notes && <div><dt>HR notes</dt><dd>{request.notes}</dd></div>}
          </dl>
          <div className="hrm-exit-request__actions">
            {request.resignationLetterUrl && <a className="text-action" href={request.resignationLetterUrl} target="_blank" rel="noreferrer">Open supporting document →</a>}
            {canReview && <EmployeeExitReviewForm request={request} />}
          </div>
        </article>)}
      </div> : <div className="student-empty"><h3>No pending exit requests</h3><p>Submitted requests awaiting School Admin or Principal approval appear here.</p></div>}
    </section>

    <section className="hrm-exit-list-section">
      <div className="student-panel-heading"><h2>Reviewed cases &amp; archive</h2><span>{completedRequests.length} reviewed cases</span></div>
      {completedRequests.length ? <div className="student-table-wrap">
        <table className="student-table">
          <thead><tr><th>Employee</th><th>Type / ID</th><th>Effective / issued date</th><th>Reason</th><th>Decision</th><th>Reviewed</th><th>Document</th></tr></thead>
          <tbody>{completedRequests.map((request) => {
            const profilePath = request.employeeId
              ? `/${request.employeeType === "teacher" ? "teachers" : "staff"}/${request.employeeId}`
              : null;
            return <tr key={request.id}>
              <td>{profilePath
                ? <><Link className="student-name" href={profilePath}><strong>{request.employeeName}</strong><small>Open profile</small></Link><Link className="text-action hrm-exit-card-link" href={request.idCardHref} target="_blank">ID card →</Link></>
                : request.employeeName}</td>
              <td><span className={`hrm-exit-type-tag hrm-exit-type-tag--${request.actionType}`}>{request.actionType === "resignation" ? "Resignation" : request.actionType === "termination" ? "Termination" : "Warning"}</span><small>{request.employeeType === "teacher" ? "Teacher" : "Staff"} · {request.employeeCode}</small></td>
              <td>{request.terminatedOn}</td>
              <td>{request.reason}</td>
              <td>
                <span className={`status-pill ${request.status}`}>
                  {request.status === "rejected"
                    ? "Rejected"
                    : request.actionType === "warning"
                      ? "Warning issued · active"
                      : "Approved · archived"}
                </span>
                {request.status === "approved" && request.actionType !== "warning" && <small className="hrm-exit-access-removed">School access removed</small>}
                {request.decisionNotes && <small className="hrm-exit-decision-note">{request.decisionNotes}</small>}
              </td>
              <td>{request.decisionAt ? <HrmLocalDateTime value={request.decisionAt} /> : "—"}</td>
              <td>{request.resignationLetterUrl ? <a className="text-action" href={request.resignationLetterUrl} target="_blank" rel="noreferrer">Open document →</a> : "—"}</td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <div className="student-empty"><h3>No reviewed cases yet</h3><p>Approved exits, warnings, and rejected requests will remain available here.</p></div>}
    </section>
  </main>;
}
