"use client";

import { useEffect, useRef, useState } from "react";

export function AccountEditPanel({ children, label = "Edit" }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const drawer = drawerRef.current;
    document.body.style.overflow = "hidden";
    drawer?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawer) return;

      const focusable = drawer.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) {
        event.preventDefault();
        drawer.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === drawer)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
      else trigger?.focus();
    };
  }, [open]);

  return <>
    <button
      ref={triggerRef}
      type="button"
      className="admin-button admin-button--primary account-edit-panel__toggle"
      aria-haspopup="dialog"
      onClick={() => setOpen(true)}
    >
      {label}
    </button>
    {open && <div className="account-edit-panel__overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setOpen(false);
    }}>
      <aside
        ref={drawerRef}
        className="account-edit-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Edit account"
        tabIndex={-1}
      >
        <header className="account-edit-drawer__header">
          <div><p>Account management</p><h2>Edit account</h2></div>
          <button type="button" className="account-edit-drawer__close" aria-label="Close edit account panel" onClick={() => setOpen(false)}>×</button>
        </header>
        <div className="account-edit-drawer__content">{children}</div>
      </aside>
    </div>}
  </>;
}
