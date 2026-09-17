import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/students/:path*",
    "/teachers/:path*",
    "/staff/:path*",
    "/parents/:path*",
    "/parent/:path*",
    "/attendance/:path*",
    "/timetable/:path*",
    "/curriculum/:path*",
    "/exams/:path*",
    "/results/:path*",
    "/finance/:path*",
    "/assignments/:path*",
    "/library/:path*",
    "/transport/:path*",
    "/inventory/:path*",
    "/leave/:path*",
    "/notifications/:path*",
    "/documents/:path*",
    "/audit/:path*",
    "/search/:path*",
    "/reports/:path*",
    "/sign-in",
    "/forgot-password",
    "/reset-password",
  ],
};