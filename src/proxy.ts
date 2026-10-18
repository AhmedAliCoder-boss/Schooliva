import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/users/:path*",
    "/dashboard/:path*",
    "/profile/:path*",
    "/students/:path*",
    "/admissions/:path*",
    "/teachers/:path*",
    "/staff/:path*",
    "/parents/:path*",
    "/parent/:path*",
    "/attendance/:path*",
    "/timetable/:path*",
    "/curriculum/:path*",
    "/academic-planning/:path*",
    "/academic-structure/:path*",
    "/exams/:path*",
    "/results/:path*",
    "/certificates/:path*",
    "/finance/:path*",
    "/assignments/:path*",
    "/library/:path*",
    "/transport/:path*",
    "/inventory/:path*",
    "/cafeteria/:path*",
    "/leave/:path*",
    "/hrm/:path*",
    "/payroll/:path*",
    "/people-attendance/:path*",
    "/notifications/:path*",
    "/documents/:path*",
    "/audit/:path*",
    "/search/:path*",
    "/reports/:path*",
    "/slc-tc/:path*",
    "/setup/:path*",
    "/sign-in",
    "/forgot-password",
  ],
};