type ProgressWheelProps = {
  label: string;
  value: string | number;
  percentage: number;
  color: string;
  detail?: string;
};

export function ProgressWheel({ label, value, percentage, color, detail }: ProgressWheelProps) {
  const progress = Number.isFinite(percentage) ? Math.min(100, Math.max(0, Math.round(percentage))) : 0;
  const displayedValue = String(value);

  return (
    <div className="progress-wheel-card" role="img" aria-label={`${label}: ${displayedValue}; ${detail ?? `${progress}%`}`}>
      <i className="progress-wheel-card__ring" style={{ background: `conic-gradient(${color} ${progress}%, #e5eaf1 0)` }}>
        <b>{displayedValue}</b>
      </i>
      <em>{label}</em>
      <small>{detail ?? `${progress}%`}</small>
    </div>
  );
}
