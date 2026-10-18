"use client";

import { useActionState } from "react";

import { reviewSupportRequest } from "@/app/actions/support";
import type { SupportActionState, SupportPriority, SupportStatus } from "@/lib/support/types";
import { supportCategories, supportStatuses } from "@/lib/support/types";

export type AdminSupportRequestRow = {
  id: string;
  schoolName: string;
  requesterName: string;
  requesterEmail: string;
  category: string;
  priority: SupportPriority;
  subject: string;
  description: string;
  status: SupportStatus;
  adminResponse: string | null;
  createdAt: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function SupportReviewForm({ request }: { request: AdminSupportRequestRow }) {
  const [state, action, pending] = useActionState<SupportActionState, FormData>(reviewSupportRequest, {});
  return (
    <form action={action} className="support-review-form">
      <input type="hidden" name="requestId" value={request.id} />
      <label>Status
        <select name="status" defaultValue={request.status}>
          {supportStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        </select>
      </label>
      <label>Response to requester
        <textarea name="adminResponse" maxLength={3000} defaultValue={request.adminResponse ?? ""} placeholder="Share the review result or next steps. This is sent as an in-app notification and email." rows={4} />
      </label>
      {state.error && <p className="support-message is-error" role="alert">{state.error}</p>}
      {state.success && <p className="support-message is-success" role="status">{state.success}</p>}
      {state.warning && <p className="support-message is-warning" role="status">{state.warning}</p>}
      <button type="submit" className="support-submit" disabled={pending}>{pending ? "Saving…" : "Save review & notify"}<span aria-hidden="true">→</span></button>
    </form>
  );
}

export function AdminSupportInbox({ requests }: { requests: AdminSupportRequestRow[] }) {
  const openCount = requests.filter((request) => !["resolved", "declined"].includes(request.status)).length;
  const urgentCount = requests.filter((request) => request.priority === "urgent" && !["resolved", "declined"].includes(request.status)).length;
  return (
    <div className="support-admin">
      <section className="support-admin__stats">
        <article><span>REQUESTS IN VIEW</span><strong>{requests.length}</strong><small>Newest first</small></article>
        <article><span>NEEDS FOLLOW-UP</span><strong>{openCount}</strong><small>Not resolved or declined</small></article>
        <article className={urgentCount ? "is-alert" : ""}><span>URGENT</span><strong>{urgentCount}</strong><small>Requires priority review</small></article>
      </section>
      <section className="support-admin__list">
        <div className="support-panel__heading">
          <div><span className="support-kicker">SCHOOL FEEDBACK</span><h2>Review & respond</h2></div>
          <span className="support-count">{requests.length}</span>
        </div>
        {requests.length ? requests.map((request) => (
          <article className="support-admin-ticket" key={request.id}>
            <header className="support-admin-ticket__header">
              <div><span className={`support-status is-${request.status}`}>{request.status.replaceAll("_", " ")}</span><span className={`support-priority is-${request.priority}`}>{request.priority}</span></div>
              <small>{formatDate(request.createdAt)}</small>
            </header>
            <div className="support-admin-ticket__content">
              <div>
                <p className="support-admin-ticket__school">{request.schoolName}</p>
                <h3>{request.subject}</h3>
                <p className="support-ticket__meta">{supportCategories.find((category) => category.value === request.category)?.label ?? request.category.replaceAll("_", " ")} <span>·</span> {request.requesterName} <span>·</span> {request.requesterEmail || "No email on file"}</p>
                <p className="support-ticket__description">{request.description}</p>
                <small className="support-ticket__reference">Reference {request.id.slice(0, 8).toUpperCase()}</small>
              </div>
              <SupportReviewForm request={request} />
            </div>
          </article>
        )) : <div className="support-empty"><span aria-hidden="true">✓</span><h3>Inbox is clear</h3><p>New school requests will appear here for review.</p></div>}
      </section>
    </div>
  );
}
