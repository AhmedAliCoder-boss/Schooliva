import { requireNotificationContext } from "@/lib/notifications/context";
import { NotificationCenter, type NotificationCenterRow } from "@/components/notifications/notification-center";
import { isMasterAdminUser } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/authorization";
import { redirect } from "next/navigation";

type RecipientRole = { slug: string; name: string; recipient_count: number };

export default async function NotificationsPage() {
  const current = await requireUser();
  if (await isMasterAdminUser(current.supabase, current.user.id)) redirect("/admin/notifications");

  const { supabase, schoolId, user } = await requireNotificationContext();
  const [
    { data: notifications, error: notificationError },
    { data: canManage, error: permissionError },
    { data: settings, error: settingsError },
  ] = await Promise.all([
    supabase.from("notifications")
      .select("id,event_type,title,message,entity_type,entity_id,read_at,created_at")
      .eq("school_id", schoolId)
      .eq("recipient_profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.rpc("has_permission", {
      target_school_id: schoolId,
      target_resource: "notifications",
      target_action: "manage",
    }),
    supabase.from("school_settings")
      .select("timezone")
      .eq("school_id", schoolId)
      .maybeSingle(),
  ]);
  if (notificationError || permissionError || settingsError) {
    console.error("Notification center data could not be loaded.", { notificationError, permissionError, settingsError });
    throw new Error("Notification center data could not be loaded.");
  }

  let recipientRoles: RecipientRole[] = [];
  if (canManage) {
    const { data: roles, error: rolesError } = await supabase.rpc("get_notification_recipient_roles", { target_school_id: schoolId });
    if (rolesError) {
      console.error("Notification recipient roles could not be loaded.", rolesError);
      throw new Error("Notification recipient roles could not be loaded.");
    }
    const roleRows = (roles ?? []) as Array<{ slug: string | null; name: string | null; recipient_count: number | null }>;
    recipientRoles = roleRows.flatMap((role) => {
      if (!role.slug || !role.name) return [];
      return [{ slug: role.slug, name: role.name, recipient_count: Number(role.recipient_count ?? 0) }];
    });
  }

  const rows = (notifications ?? []) as NotificationCenterRow[];
  const unreadCount = rows.filter((notification) => !notification.read_at).length;
  return <main className="notification-page">
    <header className="notification-page__hero">
      <div><span>COMMUNICATION CENTER</span><h1>Notifications</h1><p>Role-aware school updates, personal alerts, and a searchable history—all in one inbox.</p></div>
      <div className="notification-page__summary"><strong>{unreadCount}</strong><span>unread updates</span></div>
    </header>
    <NotificationCenter
      notifications={rows}
      canManage={Boolean(canManage)}
      recipientRoles={recipientRoles}
      timeZone={settings?.timezone ?? "UTC"}
    />
  </main>;
}
