"use server";

import { revalidatePath } from "next/cache";
import { requireNotificationContext } from "@/lib/notifications/context";

export async function markNotificationRead(notificationId: string) {
  const { supabase } = await requireNotificationContext();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId);
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  const { supabase, schoolId } = await requireNotificationContext();
  await supabase.rpc("mark_all_notifications_read", { target_school_id: schoolId });
  revalidatePath("/notifications");
}
