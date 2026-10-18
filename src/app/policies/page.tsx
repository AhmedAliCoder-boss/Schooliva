import { SupportPolicies } from "@/components/support/support-policies";
import { requireSchoolSupportAccess } from "@/lib/support/access";

export default async function PoliciesPage() {
  await requireSchoolSupportAccess();
  return <main className="support-page">
    <header className="support-page__heading"><div><span className="support-kicker">SCHOOL WORKSPACE</span><h1>Policies</h1><p>Policy drafts and approved Schooliva guidance.</p></div></header>
    <SupportPolicies />
  </main>;
}
