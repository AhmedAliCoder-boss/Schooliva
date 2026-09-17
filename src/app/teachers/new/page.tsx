import Link from "next/link";

import { TeacherForm } from "@/components/people/people-forms";
import { requirePeopleContext } from "@/lib/people/context";

export default async function NewTeacherPage() { await requirePeopleContext("teachers", "manage"); return <main className="student-editor-shell"><header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/teachers">Back to teachers -&gt;</Link></header><section className="student-editor-heading"><p className="eyebrow">Teacher management</p><h1>Add a teacher.</h1><p>Create a faculty profile and assign academic responsibilities after saving.</p></section><TeacherForm /></main>; }