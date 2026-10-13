import Link from "next/link";

import { EmployeeAccountRequestForm } from "@/components/hrm/employee-account-request-form";
import { EmployeePhotoPanel, EmployeeVerificationPanel, getEmployeePhotoUrl, isEmployeeIdCardReady } from "@/components/hrm/employee-verification-panel";
import { AssignmentForm, DeleteAssignmentForm, TeacherForm } from "@/components/people/people-forms";
import { requirePeopleContext } from "@/lib/people/context";

function relation<T>(value: unknown): T | null { return Array.isArray(value) ? (value[0] ?? null) as T : (value as T | null); }

export default async function TeacherProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, schoolId, user } = await requirePeopleContext("teachers", "view");
  const [{ data: teacher }, { data: assignments }, { data: classes }, { data: sections }, { data: subjects }] = await Promise.all([
    supabase.from("teachers").select("*").eq("id", id).eq("school_id", schoolId).maybeSingle(),
    supabase.from("teacher_assignments").select("id,assignment_type,class_id,section_id,subject_id,academic_session_id,classes(name),sections(name),subjects(name,code),academic_sessions(name)").eq("teacher_id", id).eq("school_id", schoolId),
    supabase.from("classes").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("sections").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("subjects").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
  ]);
  if (!teacher) return <main className="student-profile-shell"><h1>Teacher not found.</h1></main>;

  const record = teacher as unknown as Record<string, string | null>;
  const rows = (assignments ?? []) as Array<Record<string, unknown>>;
  const [{ data: canManage, error: permissionError }, photoUrl, idCardReady, { data: actorRoles, error: actorRolesError }, { data: roles, error: rolesError }, { data: requests, error: requestError }] = await Promise.all([
    supabase.rpc("has_permission", {
      target_school_id: schoolId,
      target_resource: "recruitment",
      target_action: "manage",
    }),
    getEmployeePhotoUrl(record.photo_path ?? null),
    isEmployeeIdCardReady(supabase, schoolId, "teacher", id, record.photo_path ?? null),
    supabase.from("user_roles").select("roles!inner(slug)").eq("user_id", user.id).eq("school_id", schoolId),
    supabase.from("roles").select("id,name,slug,school_id").or(`school_id.is.null,school_id.eq.${schoolId}`).order("name"),
    supabase.from("hrm_account_requests").select("id").eq("school_id", schoolId).eq("employee_type", "teacher").eq("employee_id", id).eq("status", "pending").limit(1),
  ]);
  if (permissionError) throw new Error("Employee file permissions could not be verified.");
  if (actorRolesError || rolesError || requestError) throw new Error("Employee account-request details could not be loaded.");
  const employeeName = `${record.first_name ?? ""} ${record.last_name ?? ""}`.trim();
  const actorRoleSlugs = (actorRoles ?? []).flatMap((row) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return role && typeof role === "object" && "slug" in role && typeof role.slug === "string" ? [role.slug] : [];
  });
  const canRequestAccount = actorRoleSlugs.some((slug) => slug === "school_admin" || slug === "principal");
  const requestRoles = (roles ?? []).filter((role) =>
    (role.school_id == null || role.school_id === schoolId) && role.slug === "teacher"
  );

  return <main className="student-profile-shell hrm-employee-profile">
    <header className="students-header">
      <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
      <Link className="text-action" href="/hrm/employees?type=teacher">All teachers →</Link>
    </header>
    <section className="student-profile-heading">
      <div>
        <p className="eyebrow">HRM / Teacher profile</p>
        <h1>{employeeName}</h1>
        <p>{record.employee_code} · {record.specialization ?? "Faculty member"}</p>
      </div>
      <div className="student-profile-heading__actions">
        <span className={`status-pill ${record.employment_status}`}>{record.employment_status?.replace("_", " ")}</span>
        {idCardReady
          ? <Link className="student-primary-action" href={`/hrm/employees/teacher/${id}/id-card`}>Print employee ID card</Link>
          : <span className="student-muted">ID card unlocks after the photo and document verification are complete.</span>}
      </div>
    </section>
    <div className="student-profile-grid hrm-employee-profile-grid">
      <section className="student-panel">
        <div className="student-panel-heading"><h2>Teacher details</h2><span>Employment record</span></div>
        <TeacherForm teacher={record} />
      </section>
      <aside className="student-profile-aside">
        {canManage && <Link className="text-action" href="/hrm/exits">Manage employee exits →</Link>}
        <EmployeePhotoPanel name={employeeName} photoUrl={photoUrl} employeeId={id} employeeType="teacher" canManage={canManage === true} />
        <EmployeeVerificationPanel supabase={supabase} schoolId={schoolId} employeeType="teacher" employeeId={id} canManage={canManage === true} />
        {!record.profile_id && canRequestAccount && <EmployeeAccountRequestForm
          employeeId={id}
          employeeType="teacher"
          email={record.email ?? ""}
          roles={requestRoles}
          pendingRequest={Boolean(requests?.length)}
        />}
        <section className="student-panel">
          <div className="student-panel-heading"><h2>Academic assignments</h2><span>Class / section / subject</span></div>
          {rows.length
            ? <ul className="enrollment-list">{rows.map((item) => <li key={String(item.id)}>
                <strong>{String(item.assignment_type)}</strong>
                <span>{relation<{ name: string }>(item.classes)?.name ?? relation<{ name: string }>(item.sections)?.name ?? relation<{ name: string; code?: string }>(item.subjects)?.name ?? "-"}{relation<{ name: string }>(item.academic_sessions) ? ` · ${relation<{ name: string }>(item.academic_sessions)?.name}` : ""}</span>
                <DeleteAssignmentForm id={String(item.id)} teacherId={id} />
              </li>)}</ul>
            : <p className="student-muted">No academic assignments yet.</p>}
          <AssignmentForm teacherId={id} classes={classes ?? []} sections={sections ?? []} subjects={subjects ?? []} />
        </section>
      </aside>
    </div>
  </main>;
}