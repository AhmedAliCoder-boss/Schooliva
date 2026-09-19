"use server";

import { redirect } from "next/navigation";

import { getAuthErrorMessage } from "@/lib/auth/messages";
import { createAccountSchema, forgotPasswordSchema, resetPasswordSchema, signInSchema, type AuthFormState } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";
import { getSafeSiteOrigin, isSafeRelativePath } from "@/lib/security/validation";

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
  const { data: resolvedEmail, error: lookupError } = identifier.includes("@")
    ? { data: identifier, error: null }
    : await supabase.rpc("resolve_login_email", { login_identifier: identifier });
  if (lookupError || !resolvedEmail) return { error: "Email, username ya User ID incorrect hai." };

  const { error } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password: parsed.data.password });
  if (error) return { error: getAuthErrorMessage(error.message) };

  redirect(getSafeNextPath(formData.get("next")));
}

export async function createAccount(_: AuthFormState | undefined, formData: FormData): Promise<AuthFormState> {
  const parsed = createAccountSchema.safeParse({
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const origin = getSafeSiteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, username: parsed.data.username },
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });

  if (error) return { error: getAuthErrorMessage(error.message) };
  if (data.session) redirect("/setup");
  return { success: "Account create ho gaya. Email confirm karke sign in karein." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export async function requestPasswordReset(_: AuthFormState | undefined, formData: FormData): Promise<AuthFormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const origin = getSafeSiteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) return { error: getAuthErrorMessage(error.message) };
  return { success: "Agar ye email registered hai, reset link inbox mein bhej diya gaya hai." };
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