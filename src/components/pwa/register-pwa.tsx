"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const INSTALL_PROMPT_SHOWN_KEY = "schooliva-install-prompt-shown";
const SERVICE_WORKER_URL = "/sw.js?v=4";

export function RegisterPwa() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [offlineNotice, setOfflineNotice] = useState("");
  const modalRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(SERVICE_WORKER_URL)
        .catch((error) => console.error("PWA service worker registration failed:", error));
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const isInstalled = window.matchMedia("(display-mode: standalone)").matches
        || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (isInstalled) return;

      if (sessionStorage.getItem(INSTALL_PROMPT_SHOWN_KEY) === "true") return;

      sessionStorage.setItem(INSTALL_PROMPT_SHOWN_KEY, "true");
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setInstallError("");
      setIsOpen(true);
    };
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsOpen(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (pathname !== "/sign-in" || new URLSearchParams(window.location.search).get("error") !== "account-inactive") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.ready
      .then((registration) => registration.active?.postMessage({ type: "CLEAR_PRIVATE_CACHE" }))
      .catch((error) => console.error("Schooliva could not clear private offline pages after access expired.", error));
  }, [pathname]);

  useEffect(() => {
    let mounted = true;
    let connected = navigator.onLine;
    const update = (value: boolean) => {
      connected = value;
      if (mounted) setIsOnline(value);
    };
    const checkConnection = async () => {
      if (!navigator.onLine) {
        update(false);
        return;
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch("/api/offline/health", {
          cache: "no-store",
          signal: controller.signal,
        });
        update(response.ok);
      } catch {
        update(false);
      } finally {
        window.clearTimeout(timeout);
      }
    };
    const handleOffline = () => update(false);
    const handleOnline = () => { void checkConnection(); };
    const showOfflineNotice = (message = "Connection lost. Changes have not been saved. Reconnect before editing.") => {
      setOfflineNotice(message);
      window.setTimeout(() => setOfflineNotice(""), 5000);
    };
    const handleSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      const isSignInSubmission = window.location.pathname === "/sign-in";
      const isSignOutSubmission = form.matches(
        ".schooliva-sidebar__sign-out, .workspace-header__signout, .schooliva-shell__sign-out",
      );
      if (isSignOutSubmission || (isSignInSubmission && connected)) {
        navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PRIVATE_CACHE" });
      }
      if (!connected) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showOfflineNotice(isSignOutSubmission
          ? "Offline copies were cleared, but reconnect to securely end your sign-in session."
          : undefined);
      }
    };
    const handleOfflineNavigation = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const writeButton = event.target.closest<HTMLButtonElement>("button[data-offline-write]");
      if (!connected && writeButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showOfflineNotice();
        return;
      }
      if (connected || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(destination.href);
    };
    const warmOfflineRoutes = async () => {
      if (!connected || !("serviceWorker" in navigator)) return;
      try {
        const registration = await navigator.serviceWorker.ready;
        const worker = registration.active;
        if (!worker) return;
        const routes = new Set<string>([window.location.href]);
        document.querySelectorAll<HTMLAnchorElement>(
          'nav[aria-label="Main navigation"] a[href], .workspace-subnav a[href], main a[href], .schooliva-content a[href]',
        ).forEach((anchor) => {
          const destination = new URL(anchor.href, window.location.href);
          if (destination.origin === window.location.origin) routes.add(destination.href);
        });
        worker.postMessage({
          type: "CACHE_ROUTES",
          currentUrl: window.location.href,
          urls: [...routes],
        });
      } catch (error) {
        console.error("Schooliva could not prepare pages for offline viewing.", error);
      }
    };

    void checkConnection();
    const interval = window.setInterval(() => { void checkConnection(); }, 30000);
    const warmTimer = window.setTimeout(() => { void warmOfflineRoutes(); }, 1200);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    document.addEventListener("submit", handleSubmit, true);
    document.addEventListener("click", handleOfflineNavigation, true);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.clearTimeout(warmTimer);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("submit", handleSubmit, true);
      document.removeEventListener("click", handleOfflineNavigation, true);
    };
  }, [pathname]);

  useEffect(() => {
    if (isOpen) closeButtonRef.current?.focus();
  }, [isOpen]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setIsInstalling(true);
    setInstallError("");
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setIsOpen(false);
    } catch (error) {
      console.error("PWA installation could not be started.", error);
      setInstallError("Installation could not be started. Please try again from your browser menu.");
    } finally {
      setIsInstalling(false);
    }
  };

  const handleClose = () => {
    setDeferredPrompt(null);
    setIsOpen(false);
  };

  return (
    <>
      {!isOnline && <div className="pwa-offline-status" role="status" aria-live="polite">
        Offline mode: cached pages are read-only. Reconnect to load current data or save changes.
      </div>}
      {offlineNotice && <div className="pwa-offline-notice" role="alert">{offlineNotice}</div>}
      {deferredPrompt && isOpen && isOnline && <div
        className="pwa-install-modal-backdrop"
        role="presentation"
        onClick={(event) => {
          if (event.target === event.currentTarget) handleClose();
        }}
      >
        <section
          className="pwa-install-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          aria-describedby="pwa-install-description"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              handleClose();
              return;
            }
            if (event.key === "Tab") {
              const buttons = modalRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
              const firstButton = buttons?.[0];
              const lastButton = buttons?.[buttons.length - 1];
              if (event.shiftKey && document.activeElement === firstButton) {
                event.preventDefault();
                lastButton?.focus();
              } else if (!event.shiftKey && document.activeElement === lastButton) {
                event.preventDefault();
                firstButton?.focus();
              }
            }
          }}
          ref={modalRef}
        >
          <button
            ref={closeButtonRef}
            type="button"
            className="pwa-install-close"
            onClick={handleClose}
            aria-label="Close install app prompt"
          >
            <span aria-hidden="true">×</span>
          </button>

          <div className="pwa-install-content">
            <span className="pwa-install-badge" aria-hidden="true">S</span>
            <span className="pwa-install-eyebrow">Schooliva app</span>
            <h2 id="pwa-install-title">Install the app</h2>
            <p id="pwa-install-description">Add Schooliva to your device for quick access to your school workspace.</p>
          </div>

          <div className="pwa-install-actions">
            <button type="button" className="pwa-install-secondary" onClick={handleClose}>
              Not now
            </button>
            <button type="button" className="pwa-install-primary" onClick={handleInstall} disabled={isInstalling} aria-label="Install Schooliva app">
              {isInstalling ? "Opening installer..." : "Install app"}
            </button>
          </div>
          {installError && <p className="pwa-install-error" role="alert">{installError}</p>}
        </section>
      </div>}
    </>
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};
