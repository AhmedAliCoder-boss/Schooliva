import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AssignmentForm } from "@/components/assignments/assignment-forms";

function relation<T>(value: unknown): T | null { return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null; }

export default async function AssignmentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { data: membership } = await supabase.from("user_roles").select("school_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership?.school_id) redirect("/setup?onboarding=1");
  const schoolId = membership.school_id as string;

  const [{ data: sessions }, { data: classes }, { data: sections }, { data: subjects }, { data: assignments }] = await Promise.all([
    supabase.from("academic_sessions").select("id,name").eq("school_id", schoolId).order("starts_on", { ascending: false }),
    supabase.from("classes").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("sections").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("subjects").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("assignments").select("id,title,description,issue_date,due_date,status,subject_id,classes(name),sections(name),subjects(name)").eq("school_id", schoolId).order("due_date", { ascending: false }),
  ]);

  return <main className="students-shell">
    <header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/dashboard">Dashboard -&gt;</Link></header>
    <section className="students-heading"><div><p className="eyebrow">Assignments</p><h1>Homework & assignments.</h1><p>Share work, collect submissions, grade progress, and keep students and parents aligned.</p></div></section>
    <section className="setup-card"><h3>Create assignment</h3><AssignmentForm sessions={sessions ?? []} classes={classes ?? []} sections={sections ?? []} subjects={subjects ?? []} /></section>
    <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Title</th><th>Class</th><th>Section</th><th>Subject</th><th>Due</th><th>Status</th></tr></thead><tbody>{(assignments ?? []).length ? (assignments ?? []).map((assignment) => { const classRow = relation<{ name: string }>(assignment.classes); const sectionRow = relation<{ name: string }>(assignment.sections); const subjectRow = relation<{ name: string }>(assignment.subjects); return <tr key={String(assignment.id)}><td><strong>{String(assignment.title)}</strong><small>{String(assignment.description ?? "-")}</small></td><td>{classRow?.name ?? "-"}</td><td>{sectionRow?.name ?? "-"}</td><td>{subjectRow?.name ?? "-"}</td><td>{String(assignment.due_date)}</td><td><span className={`status-pill ${String(assignment.status)}`}>{String(assignment.status)}</span></td></tr>; }) : <tr><td colSpan={6}><div className="student-empty"><h3>No assignments yet</h3><p>Create the first assignment to start the workflow.</p></div></td></tr>}</tbody></table></div>
  </main>;
}
