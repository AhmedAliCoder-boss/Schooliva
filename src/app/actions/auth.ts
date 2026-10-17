"use server";

import { redirect } from "next/navigation";

import { getAuthErrorMessage } from "@/lib/auth/messages";
import { isMasterAdminUser } from "@/lib/auth/roles";
import { signInSchema, type AuthFormState } from "@/lib/auth/schemas";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSafeRelativePath } from "@/lib/security/validation";

function getSafeNextPath(value: FormDataEntryValue | null) {
  return isSafeRelativePath(typeof value === "string" ? value : null) ? value as string : "/dashboard";
}

export async function signIn(_: AuthFormState | undefined, formData: FormData): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    login: formData.get("login"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const identifier = parsed.data.login;
  let resolvedEmail = identifier.includes("@") ? identifier : null;
  if (!resolvedEmail) {
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) return { error: "Username and User ID sign-in is temporarily unavailable. Contact your administrator." };
    const { data, error: lookupError } = await adminClient.rpc("resolve_login_email", { login_identifier: identifier });
    if (lookupError) return { error: "Username and User ID sign-in is temporarily unavailable. Contact your administrator." };
    resolvedEmail = data;
  }
  if (!resolvedEmail) return { error: "We could not find an account with those details. Enter the email address or exact username saved for the account. A role name such as \"School Admin\" is not a login username." };

  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password: parsed.data.password });
  if (error) return { error: getAuthErrorMessage(error.message) };

  const { error: lifecycleSyncError } = await supabase.rpc("sync_user_school_lifecycle", {
    target_user_id: signInData.user.id,
  });
  if (lifecycleSyncError) {
    console.error("School lifecycle status could not be synchronized at sign-in.", lifecycleSyncError);
    const { error: signOutError } = await supabase.auth.signOut();
    return {
      error: signOutError
        ? "School subscription status could not be verified and the session could not be cleared. Contact your administrator."
        : "School subscription status could not be verified. Contact your administrator.",
    };
  }

  const { data: accountActive, error: accountStatusError } = await supabase.rpc("is_account_active", {
    target_user_id: signInData.user.id,
  });
  if (accountStatusError || accountActive !== true) {
    if (accountStatusError) console.error("Account and school lifecycle status could not be verified.", accountStatusError);
    const { error: signOutError } = await supabase.auth.signOut();
    return {
      error: signOutError
        ? "This account or school subscription is inactive or expired, and its session could not be cleared. Contact your administrator."
        : "This account or school subscription is inactive or expired. Contact your administrator to restore access.",
    };
  }

  const requestedNextPath = formData.get("next");
  if (!requestedNextPath && signInData.user && await isMasterAdminUser(supabase, signInData.user.id)) {
    redirect("/admin");
  }

  redirect(getSafeNextPath(requestedNextPath));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}