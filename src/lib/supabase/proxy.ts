import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseConfig } from "./env";

function redirectWithCookies(request: NextRequest, response: NextResponse, pathname: string) {
  const redirectResponse = NextResponse.redirect(new URL(pathname, request.url));
  response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseConfig();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const isAuthRoute = ["/sign-in", "/forgot-password", "/reset-password"].includes(request.nextUrl.pathname);
  const isProtectedRoute = !isAuthRoute;

  if (!user && isProtectedRoute) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    signInUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (user && isProtectedRoute) {
    const { data: accountActive, error } = await supabase.rpc("is_account_active", {
      target_user_id: user.id,
    });
    if (error) {
      return NextResponse.json({ error: "Account status could not be verified." }, { status: 503 });
    }
    if (accountActive !== true) {
      await supabase.auth.signOut();
      return redirectWithCookies(request, response, "/sign-in?error=account-inactive");
    }
  }

  if (user && isAuthRoute && request.nextUrl.pathname === "/sign-in") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}