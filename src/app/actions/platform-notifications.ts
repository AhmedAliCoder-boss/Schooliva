"use server";

import { revalidatePath } from "next/cache";

import { requireMasterAdmin } from "@/lib/admin/guard";
import { platformAnnouncementSchema } from "@/lib/notifications/schemas";

export async function sendPlatformAnnouncement(
  _: { error?: string; success?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: string; campaignId?: string }> {
  if (formData.get("confirmSend") !== "yes") {
    return { error: "Confirm the audience and message before sending." };
  }

  const parsed = platformAnnouncementSchema.safeParse({
    schoolIds: formData.getAll("schoolIds").filter((value): value is string => typeof value === "string"),
    roleSlugs: formData.getAll("roleSlugs").filter((value): value is string => typeof value === "string"),
    title: formData.get("title"),
    message: formData.get("message"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Notification details are invalid." };

  const { supabase } = await requireMasterAdmin();
  const schoolIds = [...new Set(parsed.data.schoolIds)];
  const roleSlugs = [...new Set(parsed.data.roleSlugs)];
  const { data, error } = await supabase.rpc("create_platform_notification_campaign", {
    target_school_ids: schoolIds,
    target_role_slugs: roleSlugs,
    target_title: parsed.data.title,
    target_message: parsed.data.message,
  });
  if (error) {
    const details = {
      code: error.code ?? "",
      message: error.message ?? "",
      details: error.details ?? "",
      hint: error.hint ?? "",
    };
    console.error("Master Admin notification campaign could not be sent.", details);
    const errorText = `${details.message} ${details.details} ${details.hint}`.toLowerCase();
    if (
      ["PGRST202", "42883"].includes(details.code) &&
      errorText.includes("create_platform_notification_campaign")
    ) {
      return { error: "The notification campaign database migration is not applied to this Supabase project. Apply 20261017000100_master_admin_notification_campaigns.sql, then retry." };
    }
    return { error: "Campaign could not be sent. Verify its audience and try again." };
  }

  const result = data?.[0];
  if (!result) {
    console.error("Master Admin notification campaign returned no delivery result.");
    return { error: "Campaign delivery could not be confirmed. Refresh the page before retrying." };
  }

  revalidatePath("/admin/notifications");
  revalidatePath("/notifications");
  return {
    success: `Campaign sent to ${Number(result.recipient_count)} recipients across ${Number(result.school_count)} schools.`,
    campaignId: String(result.campaign_id),
  };
}
