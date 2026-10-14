"use client";

import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";

export function NotificationReadButton({ id, unread }: { id: string; unread: boolean }) {
  return unread ? <form action={async () => { const result = await markNotificationRead(id); if (result.error) throw new Error(result.error); }}><button className="notification-read-button" type="submit">Mark read</button></form> : <span className="notification-read-state">Read</span>;
}

export function MarkAllNotificationsReadButton() {
  return <form action={async () => { const result = await markAllNotificationsRead(); if (result.error) throw new Error(result.error); }}><button className="auth-submit" type="submit">Mark all as read</button></form>;
}
