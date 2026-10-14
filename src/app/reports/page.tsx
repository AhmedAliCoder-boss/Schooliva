import { redirect } from "next/navigation";

import { ReportsWorkspace } from "@/components/reports/reports-workspace";
import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { parseReportFilters } from "@/lib/reports/filters";
import type { ReportFilterOptions, SchoolReportSummary } from "@/lib/reports/types";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function toSearchParams(values: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string") params.set(key, value);
  }
  return params;
}

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = parseReportFilters(toSearchParams(await searchParams));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { schoolId, isMasterAdmin, schoolName } = await getActiveSchoolContext(supabase, user.id);
  if (!schoolId) redirect(isMasterAdmin ? "/admin" : "/setup?onboarding=1");

  const [
    { data: summary, error: summaryError },
    { data: filterOptions, error: filterOptionsError },
  ] = await Promise.all([
    supabase.rpc("report_summary", {
      target_school_id: schoolId,
      from_date: params.from,
      to_date: params.to,
      class_filter: params.classId || null,
      section_filter: params.sectionId || null,
      session_filter: params.sessionId || null,
    }),
    supabase.rpc("report_filter_options", { target_school_id: schoolId }),
  ]);

  if (summaryError || filterOptionsError) {
    console.error("School reports could not be loaded.", { summaryError, filterOptionsError });
    throw new Error("School reports could not be loaded. Please check your report access and try again.");
  }

  return <ReportsWorkspace
    summary={(summary ?? {}) as SchoolReportSummary}
    options={(filterOptions ?? { classes: [], sections: [], sessions: [] }) as unknown as ReportFilterOptions}
    filters={params}
    schoolName={schoolName ?? "School"}
  />;
}
