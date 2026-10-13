"use client";

import { useEffect } from "react";

export function PrintAction({ label = "Print / Save PDF", autoPrint = false }: { label?: string; autoPrint?: boolean }) {
  useEffect(() => {
    if (!autoPrint) return;
    const timeout = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timeout);
  }, [autoPrint]);

  return <button className="student-primary-action no-print" type="button" onClick={() => window.print()}>{label}</button>;
}
