import Link from "next/link";
import { requireNotificationContext } from "@/lib/notifications/context";
import { MarkAllNotificationsReadButton, NotificationReadButton } from "@/components/notifications/notification-actions";

export default async function NotificationsPage() {
  const { supabase } = await requireNotificationContext();
  const { data: notifications } = await supabase.from("notifications").select("id,event_type,title,message,entity_type,entity_id,read_at,created_at").order("created_at", { ascending: false }).limit(100);
  const rows = notifications ?? [];
  const unread = rows.filter((notification) => !notification.read_at).length;
  return <main className="students-shell"><header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/dashboard">Dashboard -&gt;</Link></header><section className="students-heading"><div><p className="eyebrow">In-app notifications</p><h1>Notification center.</h1><p>{unread} unread notification{unread === 1 ? "" : "s"} for your account.</p></div><MarkAllNotificationsReadButton /></section><div className="notification-list">{rows.length ? rows.map((notification) => <article className={notification.read_at ? "notification-card" : "notification-card unread"} key={notification.id}><div><span className="notification-event">{notification.event_type.replaceAll("_", " ")}</span><h2>{notification.title}</h2><p>{notification.message}</p><small>{new Date(notification.created_at).toLocaleString()}</small></div><NotificationReadButton id={notification.id} unread={!notification.read_at} /></article>) : <div className="student-empty"><h3>No notifications</h3><p>Important school updates will appear here.</p></div>}</div></main>;
}
