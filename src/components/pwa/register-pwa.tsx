"use client";

import { useEffect, useState } from "react";

const INSTALL_PROMPT_SHOWN_KEY = "schooliva-install-prompt-shown";

export function RegisterPwa() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .catch((error) => console.error("PWA service worker registration failed:", error));

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();

      if (sessionStorage.getItem(INSTALL_PROMPT_SHOWN_KEY) === "true") return;

      sessionStorage.setItem(INSTALL_PROMPT_SHOWN_KEY, "true");
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setIsOpen(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsOpen(false);
  };

  const handleClose = () => {
    setDeferredPrompt(null);
    setIsOpen(false);
  };

  if (!deferredPrompt || !isOpen) return null;

  return (
    <div className="pwa-install-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title">
      <div className="pwa-install-modal">
        <button
          type="button"
          className="pwa-install-close"
          onClick={handleClose}
          aria-label="Close install app prompt"
        >
          ×
        </button>

        <div className="pwa-install-content">
          <span className="pwa-install-badge">Schooliva</span>
          <h2 id="pwa-install-title">Install the app</h2>
          <p>Install Schooliva for faster access and a smoother experience on this device.</p>
        </div>

        <div className="pwa-install-actions">
          <button type="button" className="pwa-install-secondary" onClick={handleClose}>
            Close
          </button>
          <button type="button" className="pwa-install-primary" onClick={handleInstall} aria-label="Install Schooliva app">
            Install app
          </button>
        </div>
      </div>
    </div>
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};
