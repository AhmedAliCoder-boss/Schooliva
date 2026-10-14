"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useActionState } from "react";

import { markAllNotificationsRead, markNotificationRead, sendRoleAnnouncement } from "@/app/actions/notifications";
import { formatNotificationDate } from "@/lib/notifications/formatting";

export type NotificationCenterRow = {
  id: string;
  event_type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

type RecipientRole = { slug: string; name: string; recipient_count: number };
type Filter = "all" | "unread" | "read";

function notificationHref(item: NotificationCenterRow) {
  if (item.event_type === "student_promotion_review" && item.entity_id) return `/students/promotions?session=${encodeURIComponent(item.entity_id)}`;
  if (item.entity_type === "fee_invoices") return "/finance/invoices";
  if (item.entity_type === "student_attendance") return "/attendance";
  if (item.entity_type === "assignments") return "/assignments";
  if (item.entity_type === "exams" || item.entity_type === "exam_results") return "/exams";
  if (item.entity_type === "leave_requests") return "/leave";
  return "";
}

function eventLabel(eventType: string) {
  return eventType.replaceAll("_", " ");
}

export function NotificationAnnouncementForm({ roles }: { roles: RecipientRole[] }) {
  const [state, action] = useActionState(sendRoleAnnouncement, undefined);
  return <form action={action} className="notification-composer">
    <div className="notification-composer__heading"><div><span>ROLE-BASED DELIVERY</span><h2>Send a school update</h2><p>Choose one or more school roles. Inactive accounts and users who opted out of in-app announcements are excluded.</p></div><span className="notification-composer__icon" aria-hidden="true">↗</span></div>
    {state?.error && <p className="student-error" role="alert">{state.error}</p>}
    {state?.success && <p className="student-success" role="status">{state.success}</p>}
    <fieldset className="notification-role-picker">
      <legend>Choose recipients</legend>
      {roles.map((role) => <label key={role.slug} className="notification-role-picker__option">
        <input type="checkbox" name="roleSlugs" value={role.slug} />
        <span><strong>{role.name}</strong><small>{role.recipient_count} active {role.recipient_count === 1 ? "member" : "members"}</small></span>
      </label>)}
    </fieldset>
    <label className="student-field">Title<input name="title" required maxLength={160} placeholder="e.g. School will close early on Friday" /></label>
    <label className="student-field">Message<textarea name="message" rows={3} required maxLength={1200} placeholder="Share the details recipients need to know." /></label>
    <button type="submit" className="notification-composer__submit">Send notification</button>
  </form>;
}

export function NotificationCenter({
  notifications,
  canManage,
  recipientRoles,
  timeZone,
}: {
  notifications: NotificationCenterRow[];
  canManage: boolean;
  recipientRoles: RecipientRole[];
  timeZone: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [actionError, setActionError] = useState("");
  const unreadCount = notifications.filter((item) => !item.read_at).length;
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return notifications.filter((item) => {
      const isReadMatch = filter === "all" || (filter === "unread" ? !item.read_at : Boolean(item.read_at));
      const text = `${item.title} ${item.message} ${item.event_type}`.toLocaleLowerCase();
      return isReadMatch && text.includes(normalizedQuery);
    });
  }, [filter, notifications, query]);

  async function markAllRead() {
    const result = await markAllNotificationsRead();
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setActionError("");
    router.refresh();
  }

  async function markRead(id: string) {
    const result = await markNotificationRead(id);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setActionError("");
    router.refresh();
  }

  return <div className="notification-center">
    {canManage && recipientRoles.length > 0 && <NotificationAnnouncementForm roles={recipientRoles} />}
    <section className="notification-inbox" aria-label="Your notifications">
      <div className="notification-inbox__heading"><div><span>PERSONAL INBOX</span><h2>Recent updates <b>{unreadCount} unread</b></h2><p>Updates are private to your account and follow your active school workspace.</p></div>{unreadCount > 0 && <button type="button" onClick={() => void markAllRead()}>Mark all read</button>}</div>
      <div className="notification-inbox__toolbar">
        <div className="notification-inbox__filters" role="group" aria-label="Filter notifications">
          {(["all", "unread", "read"] as const).map((item) => <button type="button" key={item} className={filter === item ? "active" : ""} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === "all" ? `All (${notifications.length})` : item === "unread" ? `Unread (${unreadCount})` : "Read"}</button>)}
        </div>
        <label className="notification-inbox__search"><span className="sr-only">Search notifications</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your notifications" /></label>
      </div>
      {actionError && <p className="notification-inbox__error" role="alert">{actionError}</p>}
      <div className="notification-inbox__list">
        {visible.length ? visible.map((item) => {
          const href = notificationHref(item);
          return <article className={`notification-inbox-card${item.read_at ? "" : " is-unread"}`} key={item.id}>
            <span className="notification-inbox-card__icon" aria-hidden="true">{item.event_type === "announcement" ? "↗" : item.event_type.includes("fee") || item.event_type.includes("payment") ? "¤" : item.event_type.includes("attendance") ? "✓" : "✦"}</span>
            <div className="notification-inbox-card__body">
              <div className="notification-inbox-card__meta">              <span>{eventLabel(item.event_type)}</span><time dateTime={item.created_at}>{formatNotificationDate(item.created_at, timeZone)}</time></div>
              <h3>{item.title}</h3><p>{item.message}</p>
              {href && <Link className="notification-inbox-card__action" href={href}>Open related page <span aria-hidden="true">→</span></Link>}
            </div>
            {!item.read_at && <button type="button" className="notification-inbox-card__read" onClick={() => void markRead(item.id)}>Mark read</button>}
          </article>;
        }) : <div className="notification-inbox__empty"><span aria-hidden="true">✓</span><h3>{query ? "No matching updates" : filter === "unread" ? "You’re all caught up" : "No notifications yet"}</h3><p>{query ? "Try a different search." : "Important school updates will appear here and in your notification popup."}</p></div>}
      </div>
    </section>
  </div>;
}
