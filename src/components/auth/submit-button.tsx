"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, disabled = false }: { children: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button className="auth-submit" disabled={pending || disabled} type="submit">{pending ? "Please wait..." : children}</button>;
}