"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { signOut } from "@/app/actions/auth";
import { NavIcon } from "@/components/schooliva-shell";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { buildBrandingCssVars, type BrandingTheme } from "@/lib/school-branding";

const groups = [
  { title: "MASTER ADMIN", items: [{ label: "Overview", href: "/admin", icon: "dashboard" }] },
  { title: "PLATFORM", items: [{ label: "Schools", href: "/admin/schools", icon: "schools" }, { label: "Accounts", href: "/admin/accounts", icon: "users" }, { label: "Employee requests", href: "/admin/accounts/requests", icon: "users" }, { label: "Contracts", href: "/admin/contracts", icon: "contracts" }, { label: "Trials", href: "/admin/trials", icon: "calendar" }] },
  { title: "FINANCE", items: [{ label: "Billing", href: "/admin/billing", icon: "finance" }, { label: "Payments", href: "/admin/payments", icon: "payments" }, { label: "Outstanding / Dues", href: "/admin/billing/outstanding", icon: "alert" }] },
  { title: "USAGE", items: [{ label: "Storage", href: "/admin/storage", icon: "storage" }, { label: "Usage analytics", href: "/admin/usage", icon: "reports" }] },
  { title: "MANAGEMENT", items: [{ label: "Activity / Audit", href: "/admin/activity", icon: "audit" }, { label: "Notifications", href: "/admin/notifications", icon: "notifications" }, { label: "Reports", href: "/admin/reports", icon: "reports" }] },
  { title: "SYSTEM", items: [{ label: "Admin settings", href: "/admin/settings", icon: "settings" }] },
  { title: "ACCOUNT", items: [{ label: "My profile", href: "/profile", icon: "profile" }] },
];

function activePath(pathname: string, href: string) {
  if (href === "/admin/accounts") return pathname === href || (pathname.startsWith(`${href}/`) && pathname !== `${href}/requests`);
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children, title, description, breadcrumbs = [], schoolContext, brandingTheme }: { children: React.ReactNode; title: string; description?: string; breadcrumbs?: Array<{ label: string; href?: string }>; schoolContext?: string; brandingTheme?: BrandingTheme }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const shellStyle = brandingTheme ? buildBrandingCssVars(brandingTheme) : undefined;

  return <div className={`admin-shell ${compact ? "is-compact" : ""}`} style={shellStyle}>
    <button className={`admin-overlay ${open ? "is-visible" : ""}`} aria-label="Close admin navigation" onClick={() => setOpen(false)} />
    <aside className={`admin-sidebar ${compact ? "is-compact" : ""} ${open ? "is-open" : ""}`}>
      <div className="admin-sidebar__top">
        <Link href="/admin" className="admin-brand" onClick={() => setOpen(false)} aria-label="Schooliva Admin home"><Image src="/brand/landscape_logo.png" alt="Schooliva" width={160} height={34} className="admin-brand__logo" priority /></Link>
        <button type="button" className="admin-sidebar__collapse" aria-label={compact ? "Expand admin sidebar" : "Collapse admin sidebar"} aria-expanded={!compact} title={compact ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCompact((value) => !value)}>{compact ? "→" : "←"}</button>
        <button type="button" className="admin-sidebar__close" aria-label="Close admin navigation" onClick={() => setOpen(false)}>×</button>
      </div>
      <nav className="admin-nav" aria-label="Master Admin navigation">{groups.map((group) => <div className="admin-nav__group" key={group.title}><p>{group.title}</p>{group.items.map((item) => <Link key={item.href} href={item.href} title={compact ? item.label : undefined} onClick={() => setOpen(false)} className={`admin-nav__item ${activePath(pathname, item.href) ? "is-active" : ""}`}><NavIcon name={item.icon} /><span>{item.label}</span></Link>)}</div>)}</nav>
      <div className="admin-sidebar__footer"><Link href="/admin/schools" title={compact ? "Select a school" : undefined}><span aria-hidden="true">⌂</span><span>Select a school</span></Link><span className="admin-sidebar__access-label">Master Admin access</span><form action={signOut}><button type="submit" title={compact ? "Sign out" : undefined}><span aria-hidden="true">↪</span><span>Sign out</span></button></form></div>
    </aside>
    <div className="admin-main">
      <header className="admin-header"><button className="admin-menu" aria-label="Open admin navigation" onClick={() => setOpen(true)}>☰</button><div className="admin-header__crumbs"><span>Schooliva Platform</span><b>/</b>{breadcrumbs.map((crumb, index) => <span key={`${crumb.label}-${index}`}>{crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : crumb.label}{index < breadcrumbs.length - 1 && <b>/</b>}</span>)}</div><div className="admin-header__right"><span className="admin-live"><i /> Live platform</span><NotificationBell /><Link href="/profile" className="admin-avatar" aria-label="View profile">A</Link></div></header>
      {schoolContext && <div className="admin-context"><span>Viewing School</span><strong>{schoolContext}</strong><Link href="/admin/schools">Change school</Link></div>}
      <main className="admin-content"><div className="admin-page-heading"><div><p className="admin-eyebrow">{schoolContext ? "School control" : "Master Admin"}</p><h1>{title}</h1>{description && <p>{description}</p>}</div></div>{children}</main>
    </div>
  </div>;
}

export function AdminUnavailable({ title, detail }: { title: string; detail: string }) { return <section className="admin-unavailable"><span className="admin-unavailable__mark">—</span><div><h2>{title}</h2><p>{detail}</p></div><span className="admin-badge admin-badge--neutral">Not configured</span></section>; }

const workflowMessages: Record<string, string> = {
  "contract-created": "Contract created successfully.",
  "contract-invoice-scheduled": "The invoice is scheduled. School access activates or renews only after the full invoice is paid.",
  "payment-recorded": "Payment recorded. A fully paid contract invoice activates or renews school access. Schedule the next invoice from Contracts when required.",
  "bill-created": "Platform invoice created.",
  "bills-reconciled": "Platform invoice statuses reconciled.",
  "bill-create-failed": "Platform invoice could not be created.",
  "invalid-bill": "Check the school, invoice amount, description, and due date.",
  "school-lookup-failed": "School billing details could not be loaded.",
  "school-not-found": "The selected school could not be found.",
  "invalid-payment": "Check the invoice, payment amount, method, and transaction date.",
  "bill-not-found": "The selected platform invoice could not be found.",
  "payment-exceeds-balance": "The payment exceeds the remaining invoice balance.",
  "payment-create-failed": "The payment could not be recorded. Check the invoice balance and try again.",
  "invalid-reconciliation": "Select a valid invoice to reconcile.",
  "reconciliation-failed": "Invoice records could not be reconciled.",
  "reconciliation-update-failed": "One or more invoice statuses could not be updated.",
  "contract-invoice-create-failed": "The contract was saved, but its invoice could not be scheduled. Review the contract and retry.",
  "contract-activation-failed": "The contract could not be prepared. Check that the school and contract details are valid.",
  "invalid-lifecycle-activation": "Enter valid paid contract terms. Custom agreements require an end date.",
  "contract-not-found": "The selected contract could not be found.",
  "contract-term-expired": "This signed contract term has ended. Create and sign a new agreement before invoicing a new term.",
  "invalid-contract-action": "The selected contract action is invalid.",
  "contract-paused": "Contract paused.",
  "contract-cancelled": "Contract cancelled.",
  "contract-renewed": "Contract activated or renewed.",
  "invalid-contract": "Check the school and contract details, then try again.",
  "contract-create-failed": "Contract could not be created. Check the school and contract reference.",
  "contract-pause-failed": "Contract could not be paused.",
  "contract-cancel-failed": "Contract could not be cancelled.",
  "trial-created": "Trial created successfully.",
  "trial-updated": "Trial details updated successfully.",
  "invalid-trial": "Check the school, trial dates, and seat allocation.",
  "invalid-trial-action": "The selected trial update is invalid.",
  "trial-not-found": "That trial could not be found.",
  "trial-create-failed": "Trial could not be created. Check for an existing trial with the same name.",
  "trial-update-failed": "Trial could not be updated.",
  "school-activated": "School access is active.",
  "school-deactivated": "School access is inactive.",
  "invalid-school-status": "The requested school status change is invalid.",
  "school-status-update-failed": "School status could not be updated.",
  "invalid-school": "Check the school details and try again.",
  "school-create-failed": "School could not be created. Check whether its code is already in use.",
  "school-trial-create-failed": "The school was created, but its trial could not be started.",
  "school-settings-create-failed": "School was created, but its settings could not be initialized.",
  "school-quota-create-failed": "School was created, but its storage quota could not be initialized.",
};

export function AdminWorkflowNotice({ code, success = false }: { code?: string; success?: boolean }) {
  if (!code) return null;
  const message = workflowMessages[code];
  if (!message) return null;
  return <p className={`admin-workflow-notice${success ? " is-success" : " is-error"}`} role={success ? "status" : "alert"}>{message}</p>;
}
