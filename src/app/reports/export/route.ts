import { NextResponse } from "next/server";

import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { buildSchoolReportCsv } from "@/lib/reports/export";
import { createClient } from "@/lib/supabase/server";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "school-report";
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
  }

  const { schoolId, isMasterAdmin, schoolName } = await getActiveSchoolContext(supabase, user.id);
  if (!schoolId) {
    const fallback = isMasterAdmin ? "/admin" : "/setup?onboarding=1";
    return NextResponse.redirect(new URL(fallback, process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
  }

  const { data: summary } = await supabase.rpc("report_summary", {
    target_school_id: schoolId,
    from_date: null,
    to_date: null,
    class_filter: null,
    section_filter: null,
    session_filter: null,
  });

  const csv = buildSchoolReportCsv(summary ?? {}, schoolName ?? undefined);
  const filename = `${slugify(schoolName ?? "school-report")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
