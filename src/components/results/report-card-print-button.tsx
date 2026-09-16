"use client";

export function ReportCardPrintButton() {
  return <button type="button" className="auth-submit" onClick={() => window.print()}>Print report card</button>;
}
