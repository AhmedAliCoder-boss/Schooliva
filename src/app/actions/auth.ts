"use server";

import { redirect } from "next/navigation";

import { getAuthErrorMessage } from "@/lib/auth/messages";
import { isMasterAdminUser } from "@/lib/auth/roles";
import { resetPasswordSchema, signInSchema, type AuthFormState } from "@/lib/auth/schemas";
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
  if (!resolvedEmail) return { error: "Account nahi mila. Email ya admin drawer mein save kiya exact login username enter karein; 'School Admin' role ka naam hai, login username nahi." };

  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password: parsed.data.password });
  if (error) return { error: getAuthErrorMessage(error.message) };

  const { data: accountActive, error: accountStatusError } = await supabase.rpc("is_account_active", {
    target_user_id: signInData.user.id,
  });
  if (accountStatusError || accountActive !== true) {
    const { error: signOutError } = await supabase.auth.signOut();
    return {
      error: signOutError
        ? "This account is inactive or suspended, and its session could not be cleared. Contact your administrator."
        : "This account is inactive or suspended. Contact your administrator to restore access.",
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

export async function resetPassword(_: AuthFormState | undefined, formData: FormData): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: getAuthErrorMessage(error.message) };
  redirect("/sign-in?message=Password%20updated%20successfully");
}