"use server";

import { revalidatePath } from "next/cache";

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
    const bytes = new Uint8Array(await avatar.arrayBuffer());
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = bytes.subarray(0, 8).join(",") === "137,80,78,71,13,10,26,10";
    const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    if (!(avatar.type === "image/jpeg" && isJpeg) && !(avatar.type === "image/png" && isPng) && !(avatar.type === "image/webp" && isWebp)) {
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

  const { error } = await supabase.from("profiles").update({
    full_name: fullName,
    username,
    phone: phone || null,
    ...(uploadedPath ? { avatar_path: uploadedPath } : {}),
  }).eq("id", user.id);
  if (error) {
    if (uploadedPath) await supabase.storage.from("profile-avatars").remove([uploadedPath]);
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