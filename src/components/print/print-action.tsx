"use client";

export function PrintAction({ label = "Print / Save PDF" }: { label?: string }) {
  return <button className="student-primary-action no-print" type="button" onClick={() => window.print()}>{label}</button>;
}
