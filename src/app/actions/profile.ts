"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ProfileFormState = { error?: string; success?: string };

export async function updateProfile(_: ProfileFormState | undefined, formData: FormData): Promise<ProfileFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Session expire ho gayi. Dobara sign in karein." };
  if (fullName.length < 2) return { error: "Full name kam se kam 2 characters ka hona chahiye." };

  const { error } = await supabase.from("profiles").update({ full_name: fullName, phone: phone || null }).eq("id", user.id);
  if (error) return { error: "Profile update nahi ho saki. Dobara try karein." };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: "Profile update ho gayi." };
}