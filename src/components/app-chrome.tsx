"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { GlobalSearchBar } from "@/components/search/global-search";
import { LiveClock } from "@/components/dashboard/live-clock";
import { signOut } from "@/app/actions/auth";
import { NavIcon, navGroups } from "@/components/schooliva-shell";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { getActiveHref } from "@/lib/navigation/active-path";

const excludedPrefixes = ["/", "/sign-in", "/forgot-password", "/reset-password", "/admin"];

function isExcluded(pathname: string) {
  return excludedPrefixes.some((prefix) => prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function getPageContext(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const item = navGroups.flatMap((group) => group.items)
    .filter((entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`))
    .sort((first, second) => second.href.length - first.href.length)[0];
  const label = item?.label ?? segments[0]?.replaceAll("-", " ") ?? "Workspace";
  const detail = segments.length > 1
    ? segments.slice(1).map((segment) => segment.includes("-") || /^[0-9a-f-]{20,}$/i.test(segment)
      ? (segment.includes("-") && !/^[0-9a-f-]{20,}$/i.test(segment) ? segment.replaceAll("-", " ") : "Details")
      : segment).join(" / ")
    : null;
  return { label, detail };
}

export function AppChrome({
  children,
  schoolLogoUrl,
  userName,
  userAvatarUrl,
  schoolName,
}: {
  children: React.ReactNode;
  schoolLogoUrl: string | null;
  userName: string;
  userAvatarUrl: string | null;
  schoolName: string | null;
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mountedTimer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(mountedTimer);
  }, []);
  useEffect(() => {
    const closeTimer = window.setTimeout(() => setSidebarOpen(false), 0);
    return () => window.clearTimeout(closeTimer);
  }, [pathname]);

  if (pathname.startsWith("/admin") || !mounted || isExcluded(pathname) || pathname === "/dashboard") return children;

  const pageContext = getPageContext(pathname);
  const activeHref = getActiveHref(pathname, navGroups.flatMap((group) => group.items));
  const financeNavItems = [
    { label: "Overview", href: "/finance" },
    { label: "Fee structures", href: "/finance/fees" },
    { label: "Invoices", href: "/finance/invoices" },
    { label: "Payments", href: "/finance/payments" },
    { label: "Expenses", href: "/finance/expenses" },
  ];

  return (
    <div className={`app-chrome ${compact ? "is-compact" : ""}`}>
      <button type="button" className={`app-chrome__overlay ${sidebarOpen ? "is-visible" : ""}`} aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
      <aside className={`schooliva-sidebar ${compact ? "is-compact" : ""} ${sidebarOpen ? "is-open" : ""}`} aria-label="Main navigation">
        <div className="schooliva-sidebar__top">
          <Link href="/dashboard" className="schooliva-brand" aria-label="Schooliva home">
            {schoolLogoUrl
              ? <Image src={schoolLogoUrl} alt="School logo" width={170} height={36} unoptimized className="schooliva-brand__logo" />
              : <Image src="/brand/landscape_logo.png" alt="Schooliva" width={170} height={36} className="schooliva-brand__logo" priority />}
          </Link>
          <button
            type="button"
            className="schooliva-sidebar__collapse"
            aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!compact}
            title={compact ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCompact((value) => !value)}
          >
            {compact ? "→" : "←"}
          </button>
        </div>
        <nav className="schooliva-nav" aria-label="Main navigation">
          {navGroups.map((group) => (
            <div key={group.title} className="schooliva-nav__group">
              <p className="schooliva-nav__label">{group.title}</p>
              {group.items.map((item) => {
                const active = activeHref === item.href;
                return (
                  <Link key={`${item.label}-${item.href}`} href={item.href} className={`schooliva-nav__item ${active ? "is-active" : ""}`} title={compact ? item.label : undefined} aria-current={active ? "page" : undefined} onClick={() => setSidebarOpen(false)}>
                    <span className="schooliva-nav__icon"><NavIcon name={item.icon} /></span>
                    <span className="schooliva-nav__text">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <form action={signOut} className="schooliva-sidebar__sign-out">
          <button type="submit" onClick={() => setSidebarOpen(false)}><span aria-hidden="true">↪</span><span>Sign out</span></button>
        </form>
      </aside>
      <div className="app-chrome__content">
        <header className="workspace-header">
          <div className="workspace-header__identity">
            <button type="button" className="workspace-header__menu" aria-label="Open navigation" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((value) => !value)}><span aria-hidden="true">&#9776;</span></button>
            <Link href="/dashboard" className="workspace-header__brand" aria-label="Go to school dashboard">
              {schoolLogoUrl
                ? <Image src={schoolLogoUrl} alt="" width={130} height={32} unoptimized />
                : <Image src="/brand/landscape_logo.png" alt="Schooliva" width={130} height={32} />}
            </Link>
            <span className="workspace-header__divider" aria-hidden="true" />
            <div className="workspace-header__page">
              <span>{schoolName ?? "School workspace"}</span>
              <strong>{pageContext.label}{pageContext.detail ? ` / ${pageContext.detail}` : ""}</strong>
            </div>
          </div>
          <div className="workspace-header__tools">
            <LiveClock />
            <GlobalSearchBar compact />
            <NotificationBell />
            <Link href="/profile" className="workspace-header__profile" aria-label={`Open profile for ${userName}`}>
              <span className="workspace-header__avatar">
                {userAvatarUrl
                  ? <Image src={userAvatarUrl} alt="" width={36} height={36} unoptimized />
                  : <span aria-hidden="true">{userName.trim().charAt(0).toUpperCase() || "S"}</span>}
              </span>
              <span><strong>{userName}</strong><small>My profile</small></span>
            </Link>
            <form action={signOut} className="workspace-header__signout"><button type="submit" aria-label="Sign out" title="Sign out"><span aria-hidden="true">↪</span></button></form>
          </div>
        </header>
        {pathname.startsWith("/finance") && <nav className="workspace-subnav finance-subnav" aria-label="Finance navigation">
          {financeNavItems.map((item) => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} className={pathname === item.href ? "is-active" : undefined}>{item.label}</Link>)}
        </nav>}
        {pathname.startsWith("/payroll") && <nav className="workspace-subnav finance-subnav" aria-label="Payroll navigation">
          <Link href="/payroll" aria-current={pathname === "/payroll" || /^\/payroll\/[^/]+$/.test(pathname) ? "page" : undefined} className={pathname === "/payroll" || /^\/payroll\/[^/]+$/.test(pathname) ? "is-active" : undefined}>Payroll runs</Link>
          <Link href="/payroll/settings" aria-current={pathname.startsWith("/payroll/settings") ? "page" : undefined} className={pathname.startsWith("/payroll/settings") ? "is-active" : undefined}>Policy &amp; salaries</Link>
        </nav>}
        {pathname.startsWith("/hrm") && <nav className="workspace-subnav finance-subnav" aria-label="HRM recruitment navigation">
          {[{ label: "Overview", href: "/hrm" }, { label: "Vacancies", href: "/hrm/jobs" }, { label: "Candidates", href: "/hrm/candidates" }, { label: "Interviews", href: "/hrm/interviews" }, { label: "Employees", href: "/hrm/employees" }, { label: "Employee exits", href: "/hrm/exits" }].map((item) => (
            <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} className={pathname === item.href ? "is-active" : undefined}>{item.label}</Link>
          ))}
        </nav>}
        <div className="workspace-print-brand" aria-hidden="true">
          {schoolLogoUrl && <Image src={schoolLogoUrl} alt="" width={150} height={52} unoptimized />}
          <strong>{schoolName ?? "School workspace"}</strong>
        </div>
        {children}
        <footer className="workspace-print-footer">Generated by Schooliva</footer>
      </div>
    </div>
  );
}
