import Link from "next/link";

import { ParentForm } from "@/components/parents/parent-forms";
import { requireParentContext } from "@/lib/parents/context";

export default async function NewParentPage() { await requireParentContext("create"); return <main className="student-editor-shell"><header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/parents">Back to parents -&gt;</Link></header><section className="student-editor-heading"><p className="eyebrow">Parent management</p><h1>Add a parent.</h1><p>Create a guardian profile and link their children from the profile page.</p></section><ParentForm /></main>; }