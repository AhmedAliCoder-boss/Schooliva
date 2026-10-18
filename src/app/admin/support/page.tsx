import Link from "next/link";

import { AdminShell, AdminUnavailable } from "@/components/admin/admin-shell";
import { AdminSupportInbox, type AdminSupportRequestRow } from "@/components/support/admin-support-inbox";
import { requireMasterAdmin } from "@/lib/admin/guard";
import { supportStatuses, type SupportStatus } from "@/lib/support/types";

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const { supabase } = await requireMasterAdmin();
  const selectedStatus = supportStatuses.some((status) => status.value === params.status) ? params.status as SupportStatus : "all";
  let query = supabase
    .from("support_requests")
    .select("id,school_id,requester_name,requester_email,category,priority,subject,description,status,admin_response,created_at,schools!inner(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (selectedStatus !== "all") query = query.eq("status", selectedStatus);

  const { data: requests, error } = await query;
  if (error) {
    const message = `${error.message} ${error.details ?? ""}`;
    const migrationMissing = ["support_requests", "schema cache"].some((term) => message.toLowerCase().includes(term));
    if (!migrationMissing) {
      console.error("Master Admin support inbox could not be loaded.", error);
      throw new Error("Master Admin support inbox could not be loaded.");
    }
    return <AdminShell title="Support inbox" description="Review school complaints, issues, and feature requests." breadcrumbs={[{ label: "Support" }]}>
      <AdminUnavailable title="Support center migration is not applied" detail="Apply supabase/migrations/20261018000200_school_support_center.sql to the Supabase project used by this app, then reload the inbox." />
    </AdminShell>;
  }

  const rows: AdminSupportRequestRow[] = (requests ?? []).map((request) => {
    const school = Array.isArray(request.schools) ? request.schools[0] : request.schools;
    return {
      id: request.id,
      schoolName: school && typeof school === "object" && "name" in school ? String(school.name) : "School",
      requesterName: request.requester_name,
      requesterEmail: request.requester_email,
      category: request.category,
      priority: request.priority as AdminSupportRequestRow["priority"],
      subject: request.subject,
      description: request.description,
      status: request.status as SupportStatus,
      adminResponse: request.admin_response,
      createdAt: String(request.created_at),
    };
  });

  return <AdminShell title="Support inbox" description="Review school complaints, issues, and feature requests, then notify the requester with the next step." breadcrumbs={[{ label: "Support" }]}>
    <div className="support-admin__filters" aria-label="Filter support requests">
      <Link className={selectedStatus === "all" ? "is-active" : ""} href="/admin/support">All requests</Link>
      {supportStatuses.map((status) => <Link className={selectedStatus === status.value ? "is-active" : ""} href={`/admin/support?status=${status.value}`} key={status.value}>{status.label}</Link>)}
      <Link href="/admin/support/policies">Policy drafts</Link>
    </div>
    <AdminSupportInbox requests={rows} />
  </AdminShell>;
}
