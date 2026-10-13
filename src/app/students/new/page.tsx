import Link from "next/link";

import { requireStudentContext } from "@/lib/students/context";

export default async function NewStudentPage() {
  await requireStudentContext("create");
  return <main className="student-editor-shell"><header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/students">Back to students -&gt;</Link></header><section className="student-editor-heading"><p className="eyebrow">Student management</p><h1>Complete admission first.</h1><p>After admission, the school/class/section student ID, its permanent four-digit number, and admission number are generated together with the student record. The ID card prints these fixed identifiers.</p><Link className="student-primary-action" href="/admissions/new">Start an admission application</Link></section></main>;
}