import { notFound } from "next/navigation";

import { SupportPolicyDetail } from "@/components/support/support-policies";
import { requireSchoolSupportAccess } from "@/lib/support/access";
import { getPolicyById, policyGuidance } from "@/lib/support/policies";

export function generateStaticParams() {
  return policyGuidance.map(({ id }) => ({ policyId: id }));
}

export default async function PolicyDetailPage({ params }: { params: Promise<{ policyId: string }> }) {
  await requireSchoolSupportAccess();
  const { policyId } = await params;
  const policy = getPolicyById(policyId);
  if (!policy) notFound();

  return (
    <main className="support-page">
      <header className="support-page__heading">
        <div><span className="support-kicker">SCHOOL WORKSPACE</span><h1>Policies</h1><p>Policy guidance and review status.</p></div>
      </header>
      <SupportPolicyDetail policy={policy} indexHref="/policies" detailBasePath="/policies" />
    </main>
  );
}
