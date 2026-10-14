"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";

type NotificationItem = {
  id: string;
  event_type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

type NotificationResponse = { unreadCount: number; notifications: NotificationItem[] };

function BellIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>;
}

function notificationHref(item: NotificationItem) {
  if (item.event_type === "student_promotion_review" && item.entity_id) return `/students/promotions?session=${encodeURIComponent(item.entity_id)}`;
  if (item.entity_type === "fee_invoices") return "/finance/invoices";
  if (item.entity_type === "student_attendance") return "/attendance";
  if (item.entity_type === "assignments") return "/assignments";
  if (item.entity_type === "exams" || item.entity_type === "exam_results") return "/exams";
  if (item.entity_type === "leave_requests") return "/leave";
  return "/notifications";
}

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell({ initialUnreadCount = 0 }: { initialUnreadCount?: number }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<string> | null>(null);
  const [data, setData] = useState<NotificationResponse>({ unreadCount: initialUnreadCount, notifications: [] });
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<NotificationItem | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [browserAlerts, setBrowserAlerts] = useState(false);

  const refresh = useCallback(async (initial = false) => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Notification request failed (${response.status}).`);
      const nextData = await response.json() as NotificationResponse;
      const nextIds = new Set(nextData.notifications.map((item) => item.id));
      if (!initial && seenIds.current) {
        const newest = nextData.notifications.find((item) => !seenIds.current?.has(item.id));
        if (newest) {
          setToast(newest);
          if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted" && document.visibilityState === "hidden") {
            new window.Notification(newest.title, { body: newest.message, icon: "/icons/icon-192.svg", tag: newest.id });
          }
        }
      }
      seenIds.current = nextIds;
      setData(nextData);
      setErrorMessage("");
    } catch (error) {
      console.error("Notification bell refresh failed.", error);
      setErrorMessage("Notifications are temporarily unavailable.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async (initial = false) => {
      if (active && document.visibilityState === "visible") await refresh(initial);
    };
    void load(true);
    const interval = window.setInterval(() => void load(), 20_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 8000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [open]);

  async function readAll() {
    const result = await markAllNotificationsRead();
    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    setData((current) => ({
      unreadCount: 0,
      notifications: current.notifications.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })),
    }));
  }

  async function enableBrowserAlerts() {
    if (!("Notification" in window)) {
      setErrorMessage("Browser notifications are not supported in this browser.");
      return;
    }
    const permission = await window.Notification.requestPermission();
    setBrowserAlerts(permission === "granted");
    if (permission !== "granted") setErrorMessage("Browser notification permission was not granted.");
  }

  return <div className="notification-bell" ref={panelRef}>
    <button
      type="button"
      className="notification-bell__trigger"
      aria-label={`Notifications${data.unreadCount ? `, ${data.unreadCount} unread` : ""}`}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={() => setOpen((value) => !value)}
    >
      <BellIcon />
      {data.unreadCount > 0 && <span className="notification-bell__badge">{data.unreadCount > 99 ? "99+" : data.unreadCount}</span>}
    </button>

    {toast && <div className="notification-toast" role="status">
      <span className="notification-toast__icon"><BellIcon /></span>
      <Link href={notificationHref(toast)} onClick={() => setToast(null)}><strong>{toast.title}</strong><span>{toast.message}</span></Link>
      <button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)}>×</button>
    </div>}

    {open && <section className="notification-popover" role="dialog" aria-label="Recent notifications">
      <header className="notification-popover__header">
        <div><span>YOUR INBOX</span><h2>Notifications {data.unreadCount > 0 && <b>{data.unreadCount}</b>}</h2></div>
        <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)}>×</button>
      </header>
      {errorMessage && <p className="notification-popover__error" role="alert">{errorMessage}</p>}
      <div className="notification-popover__list">
        {data.notifications.length ? data.notifications.slice(0, 6).map((item) => <Link
          href={notificationHref(item)}
          key={item.id}
          className={`notification-popover__item${item.read_at ? "" : " is-unread"}`}
          onClick={async () => {
            if (!item.read_at) {
              const result = await markNotificationRead(item.id);
              if (result.error) {
                setErrorMessage(result.error);
                return;
              }
            }
            setOpen(false);
            void refresh();
          }}
        >
          <span className="notification-popover__dot" aria-hidden="true" />
          <span className="notification-popover__copy"><strong>{item.title}</strong><span>{item.message}</span><small>{relativeTime(item.created_at)}</small></span>
        </Link>) : <div className="notification-popover__empty"><span aria-hidden="true">✓</span><strong>You’re all caught up</strong><small>New school updates will show here.</small></div>}
      </div>
      <footer className="notification-popover__footer">
        {data.unreadCount > 0 && <button type="button" onClick={() => void readAll()}>Mark all read</button>}
        <button type="button" className="notification-popover__browser" onClick={() => void enableBrowserAlerts()}>{browserAlerts ? "Browser alerts enabled" : "Enable browser alerts"}</button>
        <Link href="/notifications" onClick={() => setOpen(false)}>Open notification center <span aria-hidden="true">→</span></Link>
      </footer>
    </section>}
  </div>;
}
