"use server";

import { revalidatePath } from "next/cache";
import { requireNotificationContext } from "@/lib/notifications/context";
import { roleAnnouncementSchema } from "@/lib/notifications/schemas";

export async function markNotificationRead(notificationId: string): Promise<{ error?: string }> {
  const { supabase, schoolId, user } = await requireNotificationContext();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() })
    .eq("id", notificationId).eq("school_id", schoolId).eq("recipient_profile_id", user.id);
  if (error) {
    console.error("Notification could not be marked read.", error);
    return { error: "Notification could not be updated." };
  }
  revalidatePath("/notifications");
  return {};
}

export async function markAllNotificationsRead(): Promise<{ error?: string }> {
  const { supabase, schoolId } = await requireNotificationContext();
  const { error } = await supabase.rpc("mark_all_notifications_read", { target_school_id: schoolId });
  if (error) {
    console.error("All notifications could not be marked read.", error);
    return { error: "Notifications could not be updated." };
  }
  revalidatePath("/notifications");
  return {};
}

export async function sendRoleAnnouncement(_: { error?: string; success?: string } | undefined, formData: FormData): Promise<{ error?: string; success?: string }> {
  const parsed = roleAnnouncementSchema.safeParse({
    roleSlugs: formData.getAll("roleSlugs"),
    title: formData.get("title"),
    message: formData.get("message"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Notification details are invalid." };

  const { supabase, schoolId } = await requireNotificationContext();
  const { data: canManage, error: permissionError } = await supabase.rpc("has_permission", {
    target_school_id: schoolId,
    target_resource: "notifications",
    target_action: "manage",
  });
  if (permissionError) {
    console.error("Notification management permission could not be checked.", permissionError);
    return { error: "Notification permissions could not be verified." };
  }
  if (!canManage) return { error: "You do not have permission to send school announcements." };

  const { data: createdCount, error } = await supabase.rpc("create_role_in_app_notifications", {
    target_school_id: schoolId,
    target_role_slugs: [...new Set(parsed.data.roleSlugs)],
    target_event_type: "announcement",
    target_title: parsed.data.title,
    target_message: parsed.data.message,
    target_entity_type: null,
    target_entity_id: null,
    target_metadata: { audience_roles: [...new Set(parsed.data.roleSlugs)] },
  });
  if (error) {
    console.error("Role-based school announcement could not be sent.", error);
    return { error: "Announcement could not be sent. Check the selected audience and try again." };
  }
  revalidatePath("/notifications");
  return { success: `Announcement sent to ${Number(createdCount ?? 0)} recipient${Number(createdCount ?? 0) === 1 ? "" : "s"}.` };
}
