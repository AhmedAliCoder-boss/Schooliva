import Link from "next/link";

import { enterSchoolWorkspace } from "@/app/actions/admin";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireMasterAdmin } from "@/lib/admin/guard";

export default async function SelectedSchoolDashboardEntry({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  const { supabase } = await requireMasterAdmin();
  const { data: school, error } = await supabase.from("schools").select("id,name,code,is_active").eq("id", schoolId).maybeSingle();
  if (!school) return <AdminShell title="School unavailable" description="The selected school could not be loaded for explicit dashboard entry." breadcrumbs={[{ label: "Schools", href: "/admin/schools" }, { label: "School unavailable" }]}><section className="admin-unavailable"><div><h2>{error ? "School lookup failed" : "School not found"}</h2><p>{error?.message ?? `No school record matched ${schoolId}.`}</p></div></section></AdminShell>;

  return <AdminShell title="Enter school dashboard" description="You are about to leave the global platform panel and enter the selected school's operational dashboard." breadcrumbs={[{ label: "Schools", href: "/admin/schools" }, { label: school.name, href: `/admin/schools/${schoolId}` }, { label: "Open dashboard" }]} schoolContext={school.name}>
    <section className="admin-context-card"><div><p className="admin-kicker">Explicit tenant selection</p><h2>{school.name}</h2><p>{school.code} · {school.is_active ? "Active" : "Inactive"}</p></div><Link href={`/admin/schools/${schoolId}`} className="admin-button">Back to school management</Link></section>
    <section className="admin-panel admin-entry-panel"><p className="admin-kicker">School workspace</p><h2>Open {school.name}</h2><p>The active workspace will be restricted to this school. Your platform-wide Master Admin access remains available through the return-to-platform control.</p><form action={enterSchoolWorkspace}><input type="hidden" name="schoolId" value={schoolId} /><button className="admin-button admin-button--primary" type="submit">Enter school dashboard →</button></form></section>
  </AdminShell>;
}
