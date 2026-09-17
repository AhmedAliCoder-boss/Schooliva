"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navGroups = [
  {
    title: "Main",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
    ],
  },
  {
    title: "Academics",
    items: [
      { label: "Students", href: "/students", icon: "students" },
      { label: "Teachers", href: "/teachers", icon: "teachers" },
      { label: "Attendance", href: "/attendance", icon: "attendance" },
      { label: "Timetable", href: "/timetable", icon: "timetable" },
      { label: "Exams", href: "/exams", icon: "exams" },
      { label: "Results", href: "/results", icon: "results" },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Fees", href: "/finance", icon: "finance" },
      { label: "Payments", href: "/finance", icon: "payments" },
      { label: "Expenses", href: "/finance", icon: "expenses" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Library", href: "/library", icon: "library" },
      { label: "Transport", href: "/transport", icon: "transport" },
      { label: "Inventory", href: "/inventory", icon: "inventory" },
      { label: "Leave", href: "/leave", icon: "leave" },
    ],
  },
  {
    title: "Communication",
    items: [
      { label: "Notifications", href: "/notifications", icon: "notifications" },
      { label: "Documents", href: "/documents", icon: "documents" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Reports", href: "/reports", icon: "reports" },
      { label: "Settings", href: "/setup", icon: "settings" },
      { label: "Users & Roles", href: "/staff", icon: "users" },
      { label: "Audit Logs", href: "/audit", icon: "audit" },
    ],
  },
] as const;

function NavIcon({ name }: { name: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (name) {
    case "dashboard":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 13.5h7V4H4zm9 6.5h7V11h-7zm0-16v6.5H20V4zM4 20h7v-6.5H4z" /></svg>;
    case "students":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 18c0-2.2 2.7-3.5 6-3.5s6 1.3 6 3.5v1H4zm13 0c.4-1.3 2.4-2.3 5-2.7v-1.3c-1.7.3-3.3 1.2-4.5 2.5-.3.3-.5.7-.7 1.1z" /></svg>;
    case "teachers":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-7 7c.8-2.2 3.4-3.5 7-3.5s6.2 1.3 7 3.5" /><path {...common} d="M18.5 7.5v5M16 10h5" /></svg>;
    case "attendance":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /></svg>;
    case "timetable":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5zm0 5h16M8 5v14M16 5v14" /></svg>;
    case "exams":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M7 4.5h10l3 3V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Zm8 0v3h3M8 11h8M8 15h8" /></svg>;
    case "results":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M6 18.5V6.8A1.8 1.8 0 0 1 7.8 5h8.4A1.8 1.8 0 0 1 18 6.8v11.7M8 9h8M8 13h8M8 17h6" /></svg>;
    case "finance":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 3 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3" /></svg>;
    case "payments":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5zm3.5-2.5v14m9-10h-7m7 5h-7" /></svg>;
    case "expenses":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M5 18.5V7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v11M7 9h10M7 13h7" /></svg>;
    case "library":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M5 19V5.5A2.5 2.5 0 0 1 7.5 3H18v15.5H7.5A2.5 2.5 0 0 0 5 19Zm0 0h13M8 8h7M8 12h7" /></svg>;
    case "transport":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M3 14V8.5A2.5 2.5 0 0 1 5.5 6H17l3 4v4M6 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3 14h18" /></svg>;
    case "inventory":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5zm8 4.5v9m-8-9 8 4.5 8-4.5M12 3v9" /></svg>;
    case "leave":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 12h16M12 4v16M6 6.5C7.5 5 9.6 4 12 4c3.2 0 5.7 1.7 7 4.5M18 17.5C16.5 19 14.4 20 12 20c-3.2 0-5.7-1.7-7-4.5" /></svg>;
    case "notifications":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M15 17h5l-1.2-1.5A2.6 2.6 0 0 1 18 14.5V10a6 6 0 1 0-12 0v4.5c0 .6-.2 1.2-.6 1.7L4 17h5m6 0a3 3 0 1 1-6 0" /></svg>;
    case "documents":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M7 4.5h7l4 4V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Zm7 0v4h4" /><path {...common} d="M8.5 12h7M8.5 15.5h7" /></svg>;
    case "reports":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M6 18V6m6 12V10m6 8V4" /></svg>;
    case "settings":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 3.5v2.2m0 14.6v2.2m8.5-8.5h-2.2M5.7 12H3.5m15.1-6.6L16.6 7m-9.2 10l-2 2M16.6 17l2 2M7.4 7l-2-2m11.2 11.2L7.4 7M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" /></svg>;
    case "users":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 8c.8-2.3 3.1-3.7 6-3.7s5.2 1.4 6 3.7M17 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm3 10c-.4-1.6-2-2.9-4.5-3.5" /></svg>;
    case "audit":
      return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M7 4.5h10l3 3V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Zm8 0v3h3m-9 9h8M8 15h8" /></svg>;
    default:
      return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="8" /></svg>;
  }
}

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href || pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SchoolivaShell({
  title,
  description,
  breadcrumbs = [],
  actions,
  children,
}: {
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("schooliva-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme === "dark" || (!savedTheme && prefersDark) ? "dark" : "light";

    document.documentElement.dataset.theme = theme;
    const syncThemeState = window.setTimeout(() => setIsDarkTheme(theme === "dark"), 0);

    return () => window.clearTimeout(syncThemeState);
  }, []);

  const toggleTheme = () => {
    const theme = isDarkTheme ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("schooliva-theme", theme);
    setIsDarkTheme(theme === "dark");
  };

  return (
    <div className={`schooliva-shell ${compact ? "is-compact" : ""}`}>
      <aside className={`schooliva-sidebar ${compact ? "is-compact" : ""} ${sidebarOpen ? "is-open" : ""}`}>
        <div className="schooliva-sidebar__top">
          <Link href="/dashboard" className="schooliva-brand" aria-label="Schooliva home">
            <span className="schooliva-brand__mark">S</span>
            <span className="schooliva-brand__word">schooliva</span>
          </Link>
          <button
            type="button"
            className="schooliva-sidebar__collapse"
            aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!compact}
            onClick={() => setCompact((value) => !value)}
            title={compact ? "Expand sidebar" : "Collapse sidebar"}
          >
            {compact ? "→" : "←"}
          </button>
        </div>

        <nav className="schooliva-nav" aria-label="Main navigation">
          {navGroups.map((group) => (
            <div key={group.title} className="schooliva-nav__group">
              <p className="schooliva-nav__label">{group.title}</p>
              {group.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link key={`${item.label}-${item.href}`} href={item.href} className={`schooliva-nav__item ${active ? "is-active" : ""}`} title={item.label} aria-current={active ? "page" : undefined}>
                    <span className="schooliva-nav__icon"><NavIcon name={item.icon} /></span>
                    <span className="schooliva-nav__text">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="schooliva-shell__main">
        <header className="schooliva-header">
          <div className="schooliva-header__left">
            <button type="button" className="schooliva-mobile-toggle" aria-label="Open navigation" onClick={() => setSidebarOpen((value) => !value)}>
              ☰
            </button>
            <nav aria-label="Breadcrumb" className="schooliva-breadcrumbs">
              {breadcrumbs.length ? breadcrumbs.map((crumb, index) => (
                <span key={`${crumb.label}-${index}`} className="schooliva-breadcrumb">
                  {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span>{crumb.label}</span>}
                  {index < breadcrumbs.length - 1 && <span className="schooliva-breadcrumb__sep">/</span>}
                </span>
              )) : <span className="schooliva-breadcrumb schooliva-breadcrumb--current">{title}</span>}
            </nav>
          </div>

          <div className="schooliva-header__right">
            <label className="schooliva-search" aria-label="Global search">
              <span>⌕</span>
              <input type="search" placeholder="Search" aria-label="Search Schooliva" />
            </label>
            <button type="button" className="schooliva-icon-button" aria-label="Notifications">🔔</button>
            <button
              type="button"
              className="schooliva-icon-button"
              aria-label={isDarkTheme ? "Switch to light theme" : "Switch to dark theme"}
              aria-pressed={isDarkTheme}
              onClick={toggleTheme}
              title={isDarkTheme ? "Switch to light theme" : "Switch to dark theme"}
            >
              {isDarkTheme ? "☀" : "☾"}
            </button>
            <Link href="/profile" className="schooliva-user" aria-label="View profile">
              <span className="schooliva-user__avatar">S</span>
              <span className="schooliva-user__meta">
                <strong>Schooliva</strong>
                <small>Admin</small>
              </span>
            </Link>
          </div>
        </header>

        <main className="schooliva-content">
          <header className="page-header">
            <div>
              <p className="page-header__eyebrow">Schooliva</p>
              <h1>{title}</h1>
              {description && <p className="page-header__description">{description}</p>}
            </div>
            {actions && <div className="page-header__actions">{actions}</div>}
          </header>

          {children}
        </main>
      </div>
    </div>
  );
}
