export function FinanceFormDisclosure({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <details className="finance-form-disclosure">
      <summary>
        <span className="finance-form-disclosure__copy">
          <small>{label}</small>
          <strong>{title}</strong>
          <em>{description}</em>
        </span>
        <span className="finance-form-disclosure__toggle" aria-hidden="true">+</span>
      </summary>
      <div className="finance-form-disclosure__body">{children}</div>
    </details>
  );
}
