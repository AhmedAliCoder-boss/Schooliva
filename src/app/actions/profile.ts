"use server";

import { revalidatePath } from "next/cache";

import { isSupportedProfileImage } from "@/lib/security/profile-image";
import { createClient } from "@/lib/supabase/server";

export type ProfileFormState = { error?: string; success?: string };

export async function updateProfile(_: ProfileFormState | undefined, formData: FormData): Promise<ProfileFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const avatar = formData.get("avatar");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Your session has expired. Sign in again." };
  if (fullName.length < 2) return { error: "Full name must be at least 2 characters." };
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) return { error: "Username must be 3-30 characters and may contain only letters, numbers, periods, hyphens, or underscores." };

  let uploadedPath: string | null = null;
  if (avatar instanceof File && avatar.size > 0) {
    const extensionByType: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const extension = extensionByType[avatar.type];
    if (!extension) return { error: "Profile photo must be a JPG, PNG, or WebP file." };
    if (avatar.size > 5 * 1024 * 1024) return { error: "Profile photo must be smaller than 5 MB." };
    if (!await isSupportedProfileImage(avatar)) {
      return { error: "The profile photo file format could not be verified." };
    }

    uploadedPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(uploadedPath, avatar, {
      contentType: avatar.type,
      upsert: false,
    });
    if (uploadError) {
      if (uploadError.message.toLowerCase().includes("bucket")) {
        return { error: "Profile photo storage is not configured. Apply the latest Supabase migration." };
      }
      return { error: "The profile photo could not be uploaded. Try again." };
    }
  }

  const { data: previousProfile, error: profileReadError } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle();
  if (profileReadError) {
    if (uploadedPath) await supabase.storage.from("profile-avatars").remove([uploadedPath]);
    return { error: "The profile could not be loaded. Try again." };
  }

  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ");
  const { error } = await supabase.rpc("update_own_profile", {
    target_full_name: fullName,
    target_username: username,
    target_first_name: firstName,
    target_last_name: lastName,
    target_phone: phone,
    target_avatar_path: uploadedPath,
  });
  if (error) {
    if (uploadedPath) {
      const { error: cleanupError } = await supabase.storage.from("profile-avatars").remove([uploadedPath]);
      if (cleanupError) return { error: "Profile update failed, and the uploaded photo could not be removed." };
    }
    if (error.code === "23505") return { error: "This username is already in use by another account." };
    return { error: "The profile could not be updated. Try again." };
  }

  const previousPath = previousProfile?.avatar_path;
  if (uploadedPath && previousPath && previousPath.startsWith(`${user.id}/`)) {
    const { error: removeError } = await supabase.storage.from("profile-avatars").remove([previousPath]);
    if (removeError) {
      revalidatePath("/profile");
      revalidatePath("/dashboard");
      return { error: "The profile was updated, but the previous photo could not be removed." };
    }
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: "Profile updated." };
}