import { SupportCenterWorkspace } from "@/components/support/support-center-workspace";
import { requireSchoolSupportAccess } from "@/lib/support/access";

export default async function SupportPage() {
  const { supabase, schoolId } = await requireSchoolSupportAccess();
  const { data: requests, error } = await supabase
    .from("support_requests")
    .select("id,category,priority,subject,description,status,admin_response,created_at,updated_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("School support requests could not be loaded.", error);
    throw new Error("School support requests could not be loaded. Confirm the support center migration is applied.");
  }

  return <main className="support-page">
    <header className="support-page__heading"><div><span className="support-kicker">SCHOOL WORKSPACE</span><h1>Support center</h1><p>Contact the Schooliva platform team and follow requests from your school.</p></div></header>
    <SupportCenterWorkspace requests={(requests ?? []).map((request) => ({
      id: request.id,
      category: request.category,
      priority: request.priority as "normal" | "high" | "urgent",
      subject: request.subject,
      description: request.description,
      status: request.status as "open" | "in_review" | "planned" | "in_progress" | "resolved" | "declined",
      adminResponse: request.admin_response,
      createdAt: String(request.created_at),
      updatedAt: String(request.updated_at),
    }))} />
  </main>;
}
