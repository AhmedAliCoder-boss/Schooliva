import Link from "next/link";

import { StaffForm } from "@/components/people/people-forms";
import { requirePeopleContext } from "@/lib/people/context";

export default async function NewStaffPage() { await requirePeopleContext("staff", "manage"); return <main className="student-editor-shell"><header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/staff">Back to staff -&gt;</Link></header><section className="student-editor-heading"><p className="eyebrow">Staff management</p><h1>Add a staff member.</h1><p>Create a support-team profile and keep employment status current.</p></section><StaffForm /></main>; }