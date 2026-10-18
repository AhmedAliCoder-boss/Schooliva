import Link from "next/link";

import { frequentlyAskedQuestions, policyGuidance, type PolicyGuidance } from "@/lib/support/policies";

type SupportPoliciesProps = {
  detailBasePath?: string;
};

type SupportPolicyDetailProps = {
  policy: PolicyGuidance;
  indexHref: string;
  detailBasePath: string;
};

export function SupportPolicies({ detailBasePath = "/policies" }: SupportPoliciesProps) {
  return (
    <div className="policy-hub">
      <section className="policy-hub__intro">
        <div className="policy-hub__intro-copy">
          <span className="policy-hub__eyebrow">SCHOOLIVA · GUIDANCE CENTER</span>
          <h2>Clear guidance for your school.</h2>
          <p>
            Find practical guidance on privacy, platform use, support, and safeguarding. These drafts are not approved legal or school policies; your school’s rules and applicable requirements take precedence.
          </p>
        </div>
        <div className="policy-hub__approval" role="status" aria-label="All four policies are pending approval">
          <span className="policy-hub__approval-icon" aria-hidden="true">!</span>
          <span><strong>Pending approval</strong><small>All {policyGuidance.length} policies need review</small></span>
        </div>
      </section>

      <div className="policy-hub__layout">
        <nav className="policy-index" aria-label="Policy pages">
          <span className="policy-index__label">POLICY PAGES</span>
          {policyGuidance.map((policy) => (
            <Link href={`${detailBasePath}/${policy.id}`} key={policy.id}>
              <span>{policy.number}</span>{policy.title}
            </Link>
          ))}
          <a href="#frequently-asked-questions"><span>05</span>FAQs</a>
          <p>Guidance is a draft until approved by the responsible school and platform administrators.</p>
        </nav>

        <div className="policy-hub__content">
          <section className="policy-page-list" aria-label="Available policies">
            {policyGuidance.map((policy) => (
              <Link className="policy-page-card" href={`${detailBasePath}/${policy.id}`} key={policy.id}>
                <span className="policy-page-card__number">{policy.number}</span>
                <span className="policy-page-card__content">
                  <span className="policy-page-card__tag">{policy.tag}</span>
                  <strong>{policy.title}</strong>
                  <span className="policy-page-card__description">{policy.description}</span>
                  <span className="policy-page-card__status"><i aria-hidden="true" />Pending approval</span>
                </span>
                <span className="policy-page-card__arrow" aria-hidden="true">↗</span>
              </Link>
            ))}
          </section>

          <section className="policy-faq" id="frequently-asked-questions" aria-labelledby="policy-faq-heading">
            <header className="policy-faq__header">
              <div>
                <span className="policy-hub__eyebrow">QUICK ANSWERS</span>
                <h2 id="policy-faq-heading">Frequently asked questions</h2>
              </div>
              <span className="policy-faq__count">{frequentlyAskedQuestions.length} answers</span>
            </header>
            <div className="policy-faq__list">
              {frequentlyAskedQuestions.map((item, index) => (
                <details className="policy-faq__item" key={item.question}>
                  <summary><span className="policy-faq__number">{String(index + 1).padStart(2, "0")}</span>{item.question}<span className="policy-faq__toggle" aria-hidden="true" /></summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
            <p className="policy-faq__notice">FAQ answers are draft guidance and must be reviewed before being treated as official policy.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

export function SupportPolicyDetail({ policy, indexHref, detailBasePath }: SupportPolicyDetailProps) {
  return (
    <article className="policy-detail">
      <Link className="policy-detail__back" href={indexHref}>← All policies</Link>
      <header className="policy-detail__header">
        <div className="policy-detail__heading">
          <span className="policy-hub__eyebrow">{policy.tag} · POLICY {policy.number}</span>
          <h2>{policy.title}</h2>
          <p>{policy.description}</p>
        </div>
        <span className="policy-entry__status"><i aria-hidden="true" />Pending approval</span>
      </header>
      <aside className="policy-detail__notice" role="note">
        <strong>Draft guidance</strong>
        <p>This page is not an approved legal or school policy. Confirm the final guidance with your school and platform administrators; local rules and applicable requirements take precedence.</p>
      </aside>
      <section className="policy-detail__section" aria-label={policy.title}>
        <h3>Guidance</h3>
        <ul>{policy.points.map((point) => <li key={point}>{point}</li>)}</ul>
      </section>
      <nav className="policy-detail__switcher" aria-label="Other policy pages">
        <span>OTHER POLICY PAGES</span>
        <div>{policyGuidance.filter((item) => item.id !== policy.id).map((item) => (
          <Link href={`${detailBasePath}/${item.id}`} key={item.id}>
            <span>{item.number}</span>{item.title}<b aria-hidden="true">↗</b>
          </Link>
        ))}</div>
      </nav>
    </article>
  );
}
