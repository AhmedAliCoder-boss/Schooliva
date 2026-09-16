import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

import { isSafeRelativePath } from "@/lib/security/validation";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next");
  const safeNext = isSafeRelativePath(next) ? (next as string) : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, request.url));
  }

  return NextResponse.redirect(new URL("/sign-in?error=reset-link-invalid", request.url));
}