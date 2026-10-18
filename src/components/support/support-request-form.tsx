"use client";

import { useActionState, useEffect, useRef } from "react";

import { createSupportRequest } from "@/app/actions/support";
import type { SupportActionState } from "@/lib/support/types";
import { supportCategories } from "@/lib/support/types";

export function SupportRequestForm() {
  const [state, action, pending] = useActionState<SupportActionState, FormData>(createSupportRequest, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form action={action} className="support-form" ref={formRef}>
      <div className="support-form__heading">
        <span className="support-kicker">WE&apos;RE HERE TO HELP</span>
        <h2>Tell us what you need</h2>
        <p>Send a confidential request directly to the Schooliva platform team.</p>
      </div>
      <label>
        Request type
        <select name="category" defaultValue="issue" required>
          {supportCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
        </select>
      </label>
      <label>
        Priority
        <select name="priority" defaultValue="normal" required>
          <option value="normal">Normal — general request</option>
          <option value="high">High — blocking school work</option>
          <option value="urgent">Urgent — critical operations affected</option>
        </select>
      </label>
      <label>
        Subject
        <input name="subject" maxLength={160} minLength={3} placeholder="A short summary of your request" required />
      </label>
      <label>
        Details
        <textarea name="description" maxLength={5000} minLength={10} placeholder="Include what happened, what you expected, and any useful context." rows={6} required />
      </label>
      <p className="support-form__privacy">Please don&apos;t include student records, passwords, or other sensitive personal information.</p>
      {state.error && <p className="support-message is-error" role="alert">{state.error}</p>}
      {state.success && <p className="support-message is-success" role="status">{state.success}</p>}
      {state.warning && <p className="support-message is-warning" role="status">{state.warning}</p>}
      <button type="submit" className="support-submit" disabled={pending}>{pending ? "Sending request…" : "Send support request"}<span aria-hidden="true">→</span></button>
    </form>
  );
}
