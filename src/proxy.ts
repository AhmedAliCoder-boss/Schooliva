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
    "/sign-in",
    "/forgot-password",
    "/reset-password",
  ],
};