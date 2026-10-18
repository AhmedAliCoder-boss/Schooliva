"use client";

import { useSyncExternalStore } from "react";

import { buildWhatsAppHref } from "@/lib/admin/monthly-whatsapp-report";

const storageKey = "schooliva-monthly-whatsapp-recipient";
const storageEvent = "schooliva-monthly-whatsapp-recipient-change";

export function MonthlyWhatsAppReminder({ message, promotionMonth }: { message: string; promotionMonth: string }) {
  const phone = useSyncExternalStore(
    (callback) => {
      window.addEventListener("storage", callback);
      window.addEventListener(storageEvent, callback);
      return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener(storageEvent, callback);
      };
    },
    () => window.localStorage.getItem(storageKey) ?? "",
    () => "",
  );
  const href = buildWhatsAppHref(phone, message);

  function updatePhone(value: string) {
    window.localStorage.setItem(storageKey, value);
    window.dispatchEvent(new Event(storageEvent));
  }

  return (
    <section className="admin-panel monthly-whatsapp-reminder">
      <div className="admin-panel__heading">
        <div>
          <p className="admin-kicker">Monthly reminder · {promotionMonth}</p>
          <h2>WhatsApp payment and promotion summary</h2>
        </div>
      </div>
      <p className="dashboard-muted">
        Prepare a live summary of outstanding platform bills and completed student promotions for the previous month.
        WhatsApp opens with a draft; review it and press Send yourself.
      </p>
      <div className="monthly-whatsapp-reminder__controls">
        <label>
          WhatsApp number
          <input
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="e.g. 0370 262 9117"
            value={phone}
            onChange={(event) => updatePhone(event.target.value)}
          />
        </label>
        {href ? (
          <a className="admin-button admin-button--primary" href={href} target="_blank" rel="noreferrer">
            Open WhatsApp draft
          </a>
        ) : (
          <button className="admin-button admin-button--primary" type="button" disabled>
            Enter a valid number
          </button>
        )}
      </div>
      <small className="monthly-whatsapp-reminder__note">
        The number is saved only in this browser. This free option does not send automatically on the 1st of the month.
      </small>
    </section>
  );
}
