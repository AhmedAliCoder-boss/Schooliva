import Link from "next/link";

import { StudentForm } from "@/components/students/student-forms";
import { requireStudentContext } from "@/lib/students/context";

export default async function NewStudentPage() {
  const { supabase, schoolId } = await requireStudentContext("create");
  const [{ data: classes }, { data: sessions }, { data: sections }] = await Promise.all([supabase.from("classes").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"), supabase.from("academic_sessions").select("id,name").eq("school_id", schoolId).eq("status", "active").order("starts_on", { ascending: false }), supabase.from("sections").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name")]);
  return <main className="student-editor-shell"><header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/students">Back to students -&gt;</Link></header><section className="student-editor-heading"><p className="eyebrow">Student management</p><h1>Add a student.</h1><p>Create permanent identity data and, optionally, the first separate enrollment record.</p></section><StudentForm includeEnrollment classes={classes ?? []} sessions={sessions ?? []} sections={sections ?? []} /></main>;
}