"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signIn } from "@/app/actions/auth";

import { SubmitButton } from "./submit-button";

export function SignInForm({ nextPath, message, error }: { nextPath?: string; message?: string; error?: string }) {
  const [state, action] = useActionState(signIn, undefined);
  const errorMessage = error === "reset-link-invalid"
    ? "This password reset link is invalid or has expired."
    : error === "account-inactive"
      ? "This account or its school subscription is inactive or expired. Contact your administrator."
      : error;
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="next" value={nextPath ?? "/dashboard"} />
      {message && <p className="auth-success" role="status">{message}</p>}
      {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
      {state?.error && <p className="auth-error" role="alert">{state.error}</p>}
      <label htmlFor="login">Email, username, or user ID<input id="login" name="login" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(state?.fieldErrors?.login)} aria-describedby={state?.fieldErrors?.login ? "login-error" : undefined} required /></label>
      {state?.fieldErrors?.login && <p id="login-error" className="field-error" role="alert">{state.fieldErrors.login[0]}</p>}
      <label htmlFor="password">Password<input id="password" name="password" type="password" autoComplete="current-password" aria-invalid={Boolean(state?.fieldErrors?.password)} aria-describedby={state?.fieldErrors?.password ? "password-error" : undefined} required /></label>
      {state?.fieldErrors?.password && <p id="password-error" className="field-error" role="alert">{state.fieldErrors.password[0]}</p>}
      <SubmitButton>Sign in</SubmitButton>
      <Link className="auth-link" href="/forgot-password">Forgot your password?</Link>
    </form>
  );
}