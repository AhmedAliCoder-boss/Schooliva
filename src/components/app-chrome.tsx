"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NavIcon, navGroups } from "@/components/schooliva-shell";

const excludedPrefixes = ["/", "/sign-in", "/forgot-password", "/reset-password"];

function isExcluded(pathname: string) {
  return excludedPrefixes.some((prefix) => prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href || pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const mountedTimer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(mountedTimer);
  }, []);
  useEffect(() => {
    const closeTimer = window.setTimeout(() => setSidebarOpen(false), 0);
    return () => window.clearTimeout(closeTimer);
  }, [pathname]);

  if (!mounted || isExcluded(pathname) || pathname === "/dashboard") return children;

  return (
    <div className="app-chrome">
      <button type="button" className="app-chrome__mobile-toggle" aria-label="Open navigation" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((value) => !value)}>
        <span aria-hidden="true">&#9776;</span>
        <img src="/brand/logo.png" alt="Schooliva" />
      </button>
      <button type="button" className={`app-chrome__overlay ${sidebarOpen ? "is-visible" : ""}`} aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
      <aside className={`schooliva-sidebar ${sidebarOpen ? "is-open" : ""}`} aria-label="Main navigation">
        <div className="schooliva-sidebar__top">
          <Link href="/dashboard" className="schooliva-brand" aria-label="Schooliva home">
            <span className="schooliva-brand__mark">S</span>
            <span className="schooliva-brand__word">schooliva</span>
          </Link>
          <span aria-hidden="true" />
        </div>
        <nav className="schooliva-nav" aria-label="Main navigation">
          {navGroups.map((group) => (
            <div key={group.title} className="schooliva-nav__group">
              <p className="schooliva-nav__label">{group.title}</p>
              {group.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link key={`${item.label}-${item.href}`} href={item.href} className={`schooliva-nav__item ${active ? "is-active" : ""}`} title={item.label} aria-current={active ? "page" : undefined} onClick={() => setSidebarOpen(false)}>
                    <span className="schooliva-nav__icon"><NavIcon name={item.icon} /></span>
                    <span className="schooliva-nav__text">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
      <div className="app-chrome__content">{children}</div>
    </div>
  );
}
