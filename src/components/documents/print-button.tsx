"use client";

export function PrintButton() {
  return <button className="auth-submit" type="button" onClick={() => window.print()}>Print certificate</button>;
}
