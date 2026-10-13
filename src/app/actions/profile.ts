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

  if (!user) return { error: "Session expire ho gayi. Dobara sign in karein." };
  if (fullName.length < 2) return { error: "Full name kam se kam 2 characters ka hona chahiye." };
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) return { error: "Username 3-30 characters ka ho aur sirf letters, numbers, dot, dash ya underscore use kare." };

  let uploadedPath: string | null = null;
  if (avatar instanceof File && avatar.size > 0) {
    const extensionByType: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const extension = extensionByType[avatar.type];
    if (!extension) return { error: "Profile photo JPG, PNG ya WebP format mein honi chahiye." };
    if (avatar.size > 5 * 1024 * 1024) return { error: "Profile photo 5 MB se chhoti honi chahiye." };
    if (!await isSupportedProfileImage(avatar)) {
      return { error: "Profile photo file ka format verify nahi ho saka." };
    }

    uploadedPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(uploadedPath, avatar, {
      contentType: avatar.type,
      upsert: false,
    });
    if (uploadError) {
      if (uploadError.message.toLowerCase().includes("bucket")) {
        return { error: "Profile photo storage setup pending hai. Latest Supabase migration apply karein." };
      }
      return { error: "Profile photo upload nahi ho saki. Dobara try karein." };
    }
  }

  const { data: previousProfile, error: profileReadError } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle();
  if (profileReadError) {
    if (uploadedPath) await supabase.storage.from("profile-avatars").remove([uploadedPath]);
    return { error: "Profile read nahi ho saki. Dobara try karein." };
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
    if (error.code === "23505") return { error: "Ye username pehle se kisi aur account ke paas hai." };
    return { error: "Profile update nahi ho saki. Dobara try karein." };
  }

  const previousPath = previousProfile?.avatar_path;
  if (uploadedPath && previousPath && previousPath.startsWith(`${user.id}/`)) {
    const { error: removeError } = await supabase.storage.from("profile-avatars").remove([previousPath]);
    if (removeError) {
      revalidatePath("/profile");
      revalidatePath("/dashboard");
      return { error: "Profile update ho gayi, lekin purani photo cleanup nahi ho saki." };
    }
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: "Profile update ho gayi." };
}