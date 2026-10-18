import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { SupportPolicies } from "@/components/support/support-policies";
import { requireMasterAdmin } from "@/lib/admin/guard";

export default async function AdminSupportPoliciesPage() {
  await requireMasterAdmin();
  return <AdminShell title="Support policies" description="Draft guidance shown to school administrators and principals." breadcrumbs={[{ label: "Support", href: "/admin/support" }, { label: "Policies" }]}>
    <div className="support-admin__filters"><Link href="/admin/support">← Back to support inbox</Link></div>
    <SupportPolicies detailBasePath="/admin/support/policies" />
  </AdminShell>;
}
