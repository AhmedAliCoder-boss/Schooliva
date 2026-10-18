import Link from "next/link";

import { SupportRequestForm } from "@/components/support/support-request-form";
import { supportCategories, supportStatuses, type SupportPriority, type SupportStatus } from "@/lib/support/types";

export type SchoolSupportRequestRow = {
  id: string;
  category: string;
  priority: SupportPriority;
  subject: string;
  description: string;
  status: SupportStatus;
  adminResponse: string | null;
  createdAt: string;
  updatedAt: string;
};

function labelFor(value: string, choices: Array<{ value: string; label: string }>) {
  return choices.find((choice) => choice.value === value)?.label ?? value.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function SupportCenterWorkspace({ requests }: { requests: SchoolSupportRequestRow[] }) {
  const openCount = requests.filter((request) => !["resolved", "declined"].includes(request.status)).length;

  return (
    <div className="support-center">
      <section className="support-hero">
        <div>
          <span className="support-kicker">SCHOOLIVA CARE</span>
          <h2>Support that moves your school forward.</h2>
          <p>Report an issue, share feedback, request a feature, or ask about school policies. Your request goes to our platform team for review.</p>
          <div className="support-hero__links">
            <Link href="/policies">Read policies <span aria-hidden="true">↗</span></Link>
            <a href="mailto:ahmed.ali.office70@gmail.com">Email support <span aria-hidden="true">↗</span></a>
          </div>
        </div>
        <div className="support-hero__metric"><span>YOUR REQUESTS</span><strong>{requests.length}</strong><small>{openCount} still active</small></div>
      </section>
      <div className="support-center__grid">
        <section className="support-panel support-history">
          <div className="support-panel__heading">
            <div><span className="support-kicker">REQUEST HISTORY</span><h2>Updates from the platform team</h2></div>
            <span className="support-count">{requests.length}</span>
          </div>
          {requests.length ? <div className="support-ticket-list">{requests.map((request) => (
            <article className="support-ticket" key={request.id}>
              <div className="support-ticket__top">
                <span className={`support-status is-${request.status}`}>{labelFor(request.status, supportStatuses)}</span>
                <span className={`support-priority is-${request.priority}`}>{request.priority}</span>
              </div>
              <h3>{request.subject}</h3>
              <p className="support-ticket__meta">{labelFor(request.category, supportCategories)} <span>·</span> {formatDate(request.createdAt)}</p>
              <p className="support-ticket__description">{request.description}</p>
              {request.adminResponse && <div className="support-ticket__response"><strong>Platform team</strong><p>{request.adminResponse}</p><small>Updated {formatDate(request.updatedAt)}</small></div>}
              <small className="support-ticket__reference">Reference {request.id.slice(0, 8).toUpperCase()}</small>
            </article>
          ))}</div> : <div className="support-empty"><span aria-hidden="true">✳</span><h3>No requests yet</h3><p>When you send a request, you can follow its review and status here.</p></div>}
        </section>
        <SupportRequestForm />
      </div>
    </div>
  );
}
