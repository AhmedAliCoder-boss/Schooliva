"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const destinations = [
  { label: "Overview", description: "Pipeline and follow-up", href: "/admissions", icon: "01" },
  { label: "Applications", description: "Search and manage applicants", href: "/admissions/applications", icon: "02" },
  { label: "New application", description: "Register a new applicant", href: "/admissions/new", icon: "+" },
];

export function AdmissionsNavigation() {
  const pathname = usePathname();

  return (
    <nav className="admissions-workspace-nav" aria-label="Admissions workspace">
      {destinations.map((destination) => {
        const active = destination.href === "/admissions"
          ? pathname === destination.href
          : destination.href === "/admissions/applications"
            ? pathname === destination.href || (pathname.startsWith("/admissions/") && pathname !== "/admissions/new")
            : pathname === destination.href;

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`admissions-workspace-nav__item${active ? " is-active" : ""}`}
            href={destination.href}
            key={destination.href}
          >
            <span className="admissions-workspace-nav__icon" aria-hidden="true">{destination.icon}</span>
            <span className="admissions-workspace-nav__copy">
              <strong>{destination.label}</strong>
              <small>{destination.description}</small>
            </span>
            <span className="admissions-workspace-nav__arrow" aria-hidden="true">→</span>
          </Link>
        );
      })}
    </nav>
  );
}
