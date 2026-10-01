"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { NavIcon } from "@/components/schooliva-shell";

const groups = [
  { title: "MASTER ADMIN", items: [{ label: "Overview", href: "/admin", icon: "dashboard" }] },
  { title: "PLATFORM", items: [{ label: "Schools", href: "/admin/schools", icon: "schools" }, { label: "Accounts", href: "/admin/accounts", icon: "users" }, { label: "Contracts", href: "/admin/contracts", icon: "contracts" }, { label: "Trials", href: "/admin/trials", icon: "calendar" }] },
  { title: "FINANCE", items: [{ label: "Billing", href: "/admin/billing", icon: "finance" }, { label: "Payments", href: "/admin/payments", icon: "payments" }, { label: "Outstanding / Dues", href: "/admin/billing/outstanding", icon: "alert" }] },
  { title: "USAGE", items: [{ label: "Storage", href: "/admin/storage", icon: "storage" }, { label: "Usage analytics", href: "/admin/usage", icon: "reports" }] },
  { title: "MANAGEMENT", items: [{ label: "Activity / Audit", href: "/admin/activity", icon: "audit" }, { label: "Notifications", href: "/admin/notifications", icon: "notifications" }, { label: "Reports", href: "/admin/reports", icon: "reports" }] },
  { title: "SYSTEM", items: [{ label: "Admin settings", href: "/admin/settings", icon: "settings" }] },
];

function activePath(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children, title, description, breadcrumbs = [], schoolContext }: { children: React.ReactNode; title: string; description?: string; breadcrumbs?: Array<{ label: string; href?: string }>; schoolContext?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return <div className="admin-shell">
    <button className={`admin-overlay ${open ? "is-visible" : ""}`} aria-label="Close admin navigation" onClick={() => setOpen(false)} />
    <aside className={`admin-sidebar ${open ? "is-open" : ""}`}>
      <div className="admin-sidebar__top"><Link href="/admin" className="admin-brand" onClick={() => setOpen(false)}><span className="admin-brand__mark">S</span><span><strong>schooliva</strong><small>platform control</small></span></Link><button className="admin-sidebar__close" aria-label="Close admin navigation" onClick={() => setOpen(false)}>×</button></div>
      <nav className="admin-nav" aria-label="Master Admin navigation">{groups.map((group) => <div className="admin-nav__group" key={group.title}><p>{group.title}</p>{group.items.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`admin-nav__item ${activePath(pathname, item.href) ? "is-active" : ""}`}><NavIcon name={item.icon} /><span>{item.label}</span></Link>)}</div>)}</nav>
      <div className="admin-sidebar__footer"><Link href="/admin/schools">Select a school</Link><span>Master Admin access</span></div>
    </aside>
    <div className="admin-main">
      <header className="admin-header"><button className="admin-menu" aria-label="Open admin navigation" onClick={() => setOpen(true)}>☰</button><div className="admin-header__crumbs"><span>Schooliva Platform</span><b>/</b>{breadcrumbs.map((crumb, index) => <span key={`${crumb.label}-${index}`}>{crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : crumb.label}{index < breadcrumbs.length - 1 && <b>/</b>}</span>)}</div><div className="admin-header__right"><span className="admin-live"><i /> Live platform</span><Link href="/profile" className="admin-avatar" aria-label="View profile">A</Link></div></header>
      {schoolContext && <div className="admin-context"><span>Viewing School</span><strong>{schoolContext}</strong><Link href="/admin/schools">Change school</Link></div>}
      <main className="admin-content"><div className="admin-page-heading"><div><p className="admin-eyebrow">{schoolContext ? "School control" : "Master Admin"}</p><h1>{title}</h1>{description && <p>{description}</p>}</div></div>{children}</main>
    </div>
  </div>;
}

export function AdminUnavailable({ title, detail }: { title: string; detail: string }) { return <section className="admin-unavailable"><span className="admin-unavailable__mark">—</span><div><h2>{title}</h2><p>{detail}</p></div><span className="admin-badge admin-badge--neutral">Not configured</span></section>; }
