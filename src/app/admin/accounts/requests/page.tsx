import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { HrmAccountRequestReviewForm } from "@/components/admin/hrm-account-request-review-form";
import { isMasterAdminUser } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export default async function HrmAccountRequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: active, error: activeError }, isMasterAdmin] = await Promise.all([
    supabase.rpc("is_account_active", { target_user_id: user.id }),
    isMasterAdminUser(supabase, user.id),
  ]);
  if (activeError || active !== true) redirect("/sign-in?error=inactive");
  if (!isMasterAdmin) redirect("/dashboard?error=not-authorized");

  const { data: requests, error: requestError } = await supabase.from("hrm_account_requests")
    .select("id,school_id,employee_type,employee_id,employee_code,requested_role_id,email,username,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (requestError) {
    return <AdminShell title="Employee account requests" description="Review account requests from school HR teams." breadcrumbs={[{ label: "Accounts", href: "/admin/accounts" }, { label: "Employee requests" }]}>
      <p className="auth-error">Pending employee account requests could not be loaded. Refresh the page and try again.</p>
    </AdminShell>;
  }

  const schoolIds = [...new Set((requests ?? []).map((request) => request.school_id))];
  const roleIds = [...new Set((requests ?? []).map((request) => request.requested_role_id))];
  const teacherIds = [...new Set((requests ?? []).filter((request) => request.employee_type === "teacher").map((request) => request.employee_id))];
  const staffIds = [...new Set((requests ?? []).filter((request) => request.employee_type === "staff").map((request) => request.employee_id))];
  const [
    { data: schools, error: schoolsError },
    { data: roles, error: rolesError },
    { data: teachers, error: teachersError },
    { data: staff, error: staffError },
  ] = await Promise.all([
    schoolIds.length ? supabase.from("schools").select("id,name").in("id", schoolIds) : Promise.resolve({ data: [], error: null }),
    roleIds.length ? supabase.from("roles").select("id,name,slug").in("id", roleIds) : Promise.resolve({ data: [], error: null }),
    teacherIds.length ? supabase.from("teachers").select("id,first_name,last_name").in("id", teacherIds) : Promise.resolve({ data: [], error: null }),
    staffIds.length ? supabase.from("staff").select("id,first_name,last_name").in("id", staffIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (schoolsError || rolesError || teachersError || staffError) {
    return <AdminShell title="Employee account requests" description="Review account requests from school HR teams." breadcrumbs={[{ label: "Accounts", href: "/admin/accounts" }, { label: "Employee requests" }]}>
      <p className="auth-error">Employee or school details could not be loaded. Refresh the page and try again.</p>
    </AdminShell>;
  }

  const schoolById = new Map((schools ?? []).map((school) => [school.id, school.name]));
  const roleById = new Map((roles ?? []).map((role) => [role.id, role]));
  const teacherById = new Map((teachers ?? []).map((employee) => [employee.id, employee]));
  const staffById = new Map((staff ?? []).map((employee) => [employee.id, employee]));
  const breadcrumbs = [{ label: "Accounts", href: "/admin/accounts" }, { label: "Employee requests" }];

  return <AdminShell title="Employee account requests" description="Review the school, employee, requested login, and role before inviting an employee." breadcrumbs={breadcrumbs}>
    <section className="admin-panel">
      <header className="admin-panel__heading">
        <div><p className="admin-kicker">Master Admin review</p><h2>Pending requests</h2></div>
        <span className="admin-badge admin-badge--neutral">{requests?.length ?? 0} pending</span>
      </header>
      {!requests?.length
        ? <p className="admin-empty">There are no pending employee account requests.</p>
        : <div className="hrm-account-request-list">{requests.map((request) => {
            const employee = request.employee_type === "teacher"
              ? teacherById.get(request.employee_id)
              : staffById.get(request.employee_id);
            const employeeName = employee ? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() : "Employee record unavailable";
            const role = roleById.get(request.requested_role_id);
            return <article className="hrm-account-request-card" key={request.id}>
              <div className="hrm-account-request-card__details">
                <p className="admin-kicker">{request.employee_type === "teacher" ? "Teacher" : "Staff"} · {request.employee_code}</p>
                <h3>{employeeName}</h3>
                <dl>
                  <div><dt>School</dt><dd>{schoolById.get(request.school_id) ?? "School unavailable"}</dd></div>
                  <div><dt>Login email</dt><dd>{request.email}</dd></div>
                  <div><dt>Username</dt><dd>{request.username}</dd></div>
                  <div><dt>Requested role</dt><dd>{role?.name ?? "Role unavailable"}{role?.slug ? ` (${role.slug})` : ""}</dd></div>
                  <div><dt>Submitted</dt><dd>{new Date(request.created_at).toLocaleString()}</dd></div>
                </dl>
              </div>
              <HrmAccountRequestReviewForm requestId={request.id} />
            </article>;
          })}</div>}
    </section>
  </AdminShell>;
}
