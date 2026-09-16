"use server";

import { redirect } from "next/navigation";

import { getAuthErrorMessage } from "@/lib/auth/messages";
import { forgotPasswordSchema, resetPasswordSchema, signInSchema, type AuthFormState } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";
import { getSafeSiteOrigin, isSafeRelativePath } from "@/lib/security/validation";

function getSafeNextPath(value: FormDataEntryValue | null) {
  return isSafeRelativePath(typeof value === "string" ? value : null) ? value as string : "/dashboard";
}

export async function signIn(_: AuthFormState | undefined, formData: FormData): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: getAuthErrorMessage(error.message) };

  redirect(getSafeNextPath(formData.get("next")));
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