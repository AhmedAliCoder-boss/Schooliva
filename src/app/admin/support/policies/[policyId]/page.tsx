import { notFound } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { SupportPolicyDetail } from "@/components/support/support-policies";
import { getPolicyById, policyGuidance } from "@/lib/support/policies";
import { requireMasterAdmin } from "@/lib/admin/guard";

export function generateStaticParams() {
  return policyGuidance.map(({ id }) => ({ policyId: id }));
}

export default async function AdminSupportPolicyDetailPage({ params }: { params: Promise<{ policyId: string }> }) {
  await requireMasterAdmin();
  const { policyId } = await params;
  const policy = getPolicyById(policyId);
  if (!policy) notFound();

  return (
    <AdminShell
      title="Support policies"
      description="Draft guidance shown to school administrators and principals."
      breadcrumbs={[
        { label: "Support", href: "/admin/support" },
        { label: "Policies", href: "/admin/support/policies" },
        { label: policy.title },
      ]}
    >
      <SupportPolicyDetail
        policy={policy}
        indexHref="/admin/support/policies"
        detailBasePath="/admin/support/policies"
      />
    </AdminShell>
  );
}
