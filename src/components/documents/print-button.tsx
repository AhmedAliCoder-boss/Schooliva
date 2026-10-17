"use client";

export function PrintButton({ label = "Print certificate" }: { label?: string }) {
  return <button className="auth-submit" type="button" onClick={() => window.print()}>{label}</button>;
}
