import Link from "next/link";

import { EmployeeAccountRequestForm } from "@/components/hrm/employee-account-request-form";
import { EmployeePhotoPanel, EmployeeVerificationPanel, getEmployeePhotoUrl, isEmployeeIdCardReady } from "@/components/hrm/employee-verification-panel";
import { StaffForm } from "@/components/people/people-forms";
import { requirePeopleContext } from "@/lib/people/context";

export default async function StaffProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, schoolId, user } = await requirePeopleContext("staff", "view");
  const { data, error } = await supabase.from("staff").select("*").eq("id", id).eq("school_id", schoolId).maybeSingle();
  if (error) throw new Error("Staff profile could not be loaded.");
  if (!data) return <main className="student-profile-shell"><h1>Staff member not found.</h1></main>;
  const [{ data: canManage, error: permissionError }, photoUrl, idCardReady, { data: actorRoles, error: actorRolesError }, { data: roles, error: rolesError }, { data: requests, error: requestError }] = await Promise.all([
    supabase.rpc("has_permission", {
      target_school_id: schoolId,
      target_resource: "recruitment",
      target_action: "manage",
    }),
    getEmployeePhotoUrl(data.photo_path),
    isEmployeeIdCardReady(supabase, schoolId, "staff", id, data.photo_path),
    supabase.from("user_roles").select("roles!inner(slug)").eq("user_id", user.id).eq("school_id", schoolId),
    supabase.from("roles").select("id,name,slug,school_id").or(`school_id.is.null,school_id.eq.${schoolId}`).order("name"),
    supabase.from("hrm_account_requests").select("id").eq("school_id", schoolId).eq("employee_type", "staff").eq("employee_id", id).eq("status", "pending").limit(1),
  ]);
  if (permissionError) throw new Error("Employee file permissions could not be verified.");
  if (actorRolesError || rolesError || requestError) throw new Error("Employee account-request details could not be loaded.");
  const employeeName = `${data.first_name} ${data.last_name}`.trim();
  const actorRoleSlugs = (actorRoles ?? []).flatMap((row) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return role && typeof role === "object" && "slug" in role && typeof role.slug === "string" ? [role.slug] : [];
  });
  const canRequestAccount = actorRoleSlugs.some((slug) => slug === "school_admin" || slug === "principal");
  const requestRoles = (roles ?? []).filter((role) =>
    (role.school_id == null || role.school_id === schoolId)
    && ["staff", "accountant", "hr_manager", "librarian", "transport_manager"].includes(role.slug)
  );
  return <main className="student-profile-shell hrm-employee-profile">
    <header className="students-header">
      <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
      <Link className="text-action" href="/hrm/employees?type=staff">All staff →</Link>
    </header>
    <section className="student-profile-heading">
      <div>
        <p className="eyebrow">HRM / Staff profile</p>
        <h1>{data.first_name} {data.last_name}</h1>
        <p>{data.employee_code} · {data.designation}</p>
      </div>
      <div className="student-profile-heading__actions">
        <span className={`status-pill ${data.employment_status}`}>{data.employment_status?.replace("_", " ")}</span>
        {idCardReady
          ? <Link className="student-primary-action" href={`/hrm/employees/staff/${id}/id-card`}>Print employee ID card</Link>
          : <span className="student-muted">ID card unlocks after the photo and document verification are complete.</span>}
      </div>
    </section>
    <div className="student-profile-grid hrm-employee-profile-grid hrm-staff-profile-grid">
      <section className="student-panel hrm-staff-details-panel">
        <div className="student-panel-heading"><h2>Staff details</h2><span>Employment record</span></div>
        <EmployeePhotoPanel name={employeeName} photoUrl={photoUrl} employeeId={id} employeeType="staff" canManage={canManage === true} embedded />
        <StaffForm staff={data as Record<string, string | null>} />
      </section>
      <aside className="student-profile-aside">
        {canManage && <Link className="text-action" href="/hrm/exits">Manage employee exits →</Link>}
        <EmployeeVerificationPanel supabase={supabase} schoolId={schoolId} employeeType="staff" employeeId={id} canManage={canManage === true} />
        {!data.profile_id && canRequestAccount && <EmployeeAccountRequestForm
          employeeId={id}
          employeeType="staff"
          email={data.email ?? ""}
          roles={requestRoles}
          pendingRequest={Boolean(requests?.length)}
        />}
      </aside>
    </div>
  </main>;
}