export function PageLoadingSkeleton() {
  return (
    <main className="page-loading" aria-busy="true" aria-label="Loading page content">
      <span className="page-loading__announcement" role="status" aria-live="polite">Loading page…</span>

      <header className="page-loading__heading">
        <div className="page-loading__heading-copy">
          <span className="page-loading__block page-loading__eyebrow" />
          <span className="page-loading__block page-loading__title" />
          <span className="page-loading__block page-loading__description" />
        </div>
        <span className="page-loading__block page-loading__action" />
      </header>

      <section className="page-loading__metrics" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="page-loading__metric" key={index}>
            <span className="page-loading__block page-loading__metric-icon" />
            <span className="page-loading__metric-copy">
              <span className="page-loading__block page-loading__metric-value" />
              <span className="page-loading__block page-loading__metric-label" />
            </span>
          </div>
        ))}
      </section>

      <section className="page-loading__panel" aria-hidden="true">
        <div className="page-loading__panel-heading">
          <div>
            <span className="page-loading__block page-loading__panel-eyebrow" />
            <span className="page-loading__block page-loading__panel-title" />
          </div>
          <span className="page-loading__block page-loading__panel-control" />
        </div>
        <div className="page-loading__filters">
          <span className="page-loading__block" />
          <span className="page-loading__block" />
          <span className="page-loading__block" />
        </div>
        <div className="page-loading__rows">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="page-loading__row" key={index}>
              <span className="page-loading__block page-loading__row-primary" />
              <span className="page-loading__block page-loading__row-secondary" />
              <span className="page-loading__block page-loading__row-tertiary" />
              <span className="page-loading__block page-loading__row-status" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}