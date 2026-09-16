import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LeaveDecisionForm, LeaveRequestForm, LeaveTypeForm } from "@/components/leave/leave-forms";

export default async function LeavePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { data: membership } = await supabase.from("user_roles").select("school_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership?.school_id) redirect("/setup?onboarding=1");
  const schoolId = membership.school_id as string;
  const [{ data: types }, { data: requests }, { data: students }, { data: teachers }, { data: staff }] = await Promise.all([
    supabase.from("leave_types").select("id,name").eq("school_id", schoolId).eq("is_active", true).order("name"),
    supabase.from("leave_requests").select("id,status,start_date,end_date,reason,student_id,teacher_id,staff_id,leave_types(name)").eq("school_id", schoolId).order("created_at", { ascending: false }),
    supabase.from("students").select("id,first_name,last_name,admission_number").eq("school_id", schoolId).eq("is_active", true).order("last_name"),
    supabase.from("teachers").select("id,first_name,last_name").eq("school_id", schoolId).eq("employment_status", "active").order("last_name"),
    supabase.from("staff").select("id,first_name,last_name").eq("school_id", schoolId).eq("employment_status", "active").order("last_name"),
  ]);
  const requestRows = requests ?? [];
  const summary = { requested: requestRows.filter((row) => row.status === "requested").length, approved: requestRows.filter((row) => row.status === "approved").length, rejected: requestRows.filter((row) => row.status === "rejected").length, completed: requestRows.filter((row) => row.status === "completed").length };
  const studentOptions = (students ?? []).map((item) => ({ id: String(item.id), name: `${item.first_name ?? ""} ${item.last_name ?? ""} (${item.admission_number ?? "-"})`.trim() }));
  const teacherOptions = (teachers ?? []).map((item) => ({ id: String(item.id), name: `${item.first_name ?? ""} ${item.last_name ?? ""}`.trim() }));
  const staffOptions = (staff ?? []).map((item) => ({ id: String(item.id), name: `${item.first_name ?? ""} ${item.last_name ?? ""}`.trim() }));
  const leaveTypeName = (value: unknown) => Array.isArray(value) ? (value[0] as { name?: string } | undefined)?.name : (value as { name?: string } | null)?.name;
  return <main className="students-shell"><header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/dashboard">Dashboard -&gt;</Link></header><section className="students-heading"><div><p className="eyebrow">Leave management</p><h1>Leave requests.</h1><p>Submit, review, approve, reject, and complete school leave workflows.</p></div></section><section className="attendance-stats"><article><span>Requested</span><strong>{summary.requested}</strong></article><article><span>Approved</span><strong>{summary.approved}</strong></article><article><span>Rejected</span><strong>{summary.rejected}</strong></article><article><span>Completed</span><strong>{summary.completed}</strong></article></section><section className="setup-card"><h3>Leave types</h3><LeaveTypeForm /></section><section className="setup-card"><h3>Submit leave request</h3><LeaveRequestForm types={types ?? []} students={studentOptions} teachers={teacherOptions} staff={staffOptions} /></section><div className="student-table-wrap"><table className="student-table"><thead><tr><th>Type</th><th>Subject</th><th>Dates</th><th>Reason</th><th>Status</th><th>Decision</th></tr></thead><tbody>{requestRows.length ? requestRows.map((request) => <tr key={String(request.id)}><td>{leaveTypeName(request.leave_types) ?? "-"}</td><td>{String(request.student_id ?? request.teacher_id ?? request.staff_id ?? "-")}</td><td>{String(request.start_date)} - {String(request.end_date)}</td><td>{String(request.reason)}</td><td><span className={`status-pill ${String(request.status)}`}>{String(request.status)}</span></td><td>{request.status === "requested" && <LeaveDecisionForm id={String(request.id)} />}</td></tr>) : <tr><td colSpan={6}><div className="student-empty"><h3>No leave requests</h3><p>Leave workflow records will appear here.</p></div></td></tr>}</tbody></table></div></main>;
}
