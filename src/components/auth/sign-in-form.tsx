"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signIn } from "@/app/actions/auth";

import { SubmitButton } from "./submit-button";

export function SignInForm({ nextPath, message, error }: { nextPath?: string; message?: string; error?: string }) {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="next" value={nextPath ?? "/dashboard"} />
      {message && <p className="auth-success">{message}</p>}
      {error && <p className="auth-error">{error === "reset-link-invalid" ? "Reset link invalid ya expire ho chuka hai." : error}</p>}
      {state?.error && <p className="auth-error">{state.error}</p>}
      <label htmlFor="email">Email<input id="email" name="email" type="email" autoComplete="email" required /></label>
      {state?.fieldErrors?.email && <p className="field-error">{state.fieldErrors.email[0]}</p>}
      <label htmlFor="password">Password<input id="password" name="password" type="password" autoComplete="current-password" required /></label>
      {state?.fieldErrors?.password && <p className="field-error">{state.fieldErrors.password[0]}</p>}
      <SubmitButton>Sign in</SubmitButton>
      <Link className="auth-link" href="/forgot-password">Password bhool gaye?</Link>
    </form>
  );
}