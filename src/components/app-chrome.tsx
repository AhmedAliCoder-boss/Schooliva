"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { signOut } from "@/app/actions/auth";
import { NavIcon, navGroups } from "@/components/schooliva-shell";

const excludedPrefixes = ["/", "/sign-in", "/forgot-password", "/reset-password", "/admin"];

function isExcluded(pathname: string) {
  return excludedPrefixes.some((prefix) => prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href || pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppChrome({ children, schoolLogoUrl }: { children: React.ReactNode; schoolLogoUrl: string | null }) {
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

  if (pathname.startsWith("/admin") || !mounted || isExcluded(pathname) || pathname === "/dashboard") return children;

  return (
    <div className="app-chrome">
      <button type="button" className="app-chrome__mobile-toggle" aria-label="Open navigation" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((value) => !value)}>
        <span aria-hidden="true">&#9776;</span>
        {schoolLogoUrl
          ? <img src={schoolLogoUrl} alt="School logo" width={110} height={24} />
          : <Image src="/brand/landscape_logo.png" alt="Schooliva" width={110} height={24} />}
      </button>
      <button type="button" className={`app-chrome__overlay ${sidebarOpen ? "is-visible" : ""}`} aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
      <aside className={`schooliva-sidebar ${sidebarOpen ? "is-open" : ""}`} aria-label="Main navigation">
        <div className="schooliva-sidebar__top">
          <Link href="/dashboard" className="schooliva-brand" aria-label="Schooliva home">
            {schoolLogoUrl
              ? <img src={schoolLogoUrl} alt="School logo" width={170} height={36} className="schooliva-brand__logo" />
              : <Image src="/brand/landscape_logo.png" alt="Schooliva" width={170} height={36} className="schooliva-brand__logo" priority />}
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
        <form action={signOut} className="schooliva-sidebar__sign-out">
          <button type="submit" onClick={() => setSidebarOpen(false)}><span aria-hidden="true">↪</span><span>Sign out</span></button>
        </form>
      </aside>
      <div className="app-chrome__content">{children}</div>
    </div>
  );
}
