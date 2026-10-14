"use client";

export function PrintReportButton() {
  return <button className="reports-action reports-action--secondary reports-no-print" type="button" onClick={() => window.print()}>
    <span aria-hidden="true">⎙</span> Print report
  </button>;
}
