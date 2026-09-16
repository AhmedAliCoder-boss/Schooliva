import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function relation<T>(value: unknown): T | null { return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null; }

export default async function ResultsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { data: membership } = await supabase.from("user_roles").select("school_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership?.school_id) redirect("/setup?onboarding=1");
  const schoolId = membership.school_id as string;

  const { data: exams } = await supabase.from("exams").select("id,name,status,starts_on,ends_on,academic_sessions(name)").eq("school_id", schoolId).eq("status", "published").order("starts_on", { ascending: false });
  const rows = exams ?? [];
  return <main className="students-shell">
    <header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/dashboard">Dashboard -&gt;</Link></header>
    <section className="students-heading"><div><p className="eyebrow">Results</p><h1>Published results.</h1><p>Published results are shown here so students and parents only access approved outcomes.</p></div></section>
    <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Exam</th><th>Session</th><th>Range</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.length ? rows.map((exam) => { const session = relation<{ name: string }>(exam.academic_sessions); return <tr key={String(exam.id)}><td><strong>{String(exam.name)}</strong></td><td>{session?.name ?? "-"}</td><td>{String(exam.starts_on)} - {String(exam.ends_on)}</td><td><span className="status-pill active">{String(exam.status)}</span></td><td><Link href={`/results/${exam.id}`} className="text-action">Open result -&gt;</Link></td></tr>; }) : <tr><td colSpan={5}><div className="student-empty"><h3>No published results</h3><p>Published results will appear here after review and publication.</p></div></td></tr>}</tbody></table></div>
  </main>;
}
