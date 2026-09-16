"use client";

import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";

export function NotificationReadButton({ id, unread }: { id: string; unread: boolean }) {
  return unread ? <form action={async () => { await markNotificationRead(id); }}><button className="notification-read-button" type="submit">Mark read</button></form> : <span className="notification-read-state">Read</span>;
}

export function MarkAllNotificationsReadButton() {
  return <form action={markAllNotificationsRead}><button className="auth-submit" type="submit">Mark all as read</button></form>;
}
