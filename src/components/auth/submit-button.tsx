"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <button className="auth-submit" disabled={pending} type="submit">{pending ? "Please wait..." : children}</button>;
}