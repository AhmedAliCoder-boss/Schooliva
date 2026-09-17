"use client";

import { useActionState } from "react";

import { requestPasswordReset, resetPassword } from "@/app/actions/auth";

import { SubmitButton } from "./submit-button";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, undefined);
  return <form action={action} className="auth-form">
    {state?.error && <p className="auth-error">{state.error}</p>}
    {state?.success && <p className="auth-success">{state.success}</p>}
    <label htmlFor="email">Email<input id="email" name="email" type="email" autoComplete="email" required /></label>
    {state?.fieldErrors?.email && <p className="field-error">{state.fieldErrors.email[0]}</p>}
    <SubmitButton>Send reset link</SubmitButton>
  </form>;
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPassword, undefined);
  return <form action={action} className="auth-form">
    {state?.error && <p className="auth-error">{state.error}</p>}
    <label htmlFor="password">New password<input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
    {state?.fieldErrors?.password && <p className="field-error">{state.fieldErrors.password[0]}</p>}
    <label htmlFor="confirmPassword">Confirm password<input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
    {state?.fieldErrors?.confirmPassword && <p className="field-error">{state.fieldErrors.confirmPassword[0]}</p>}
    <SubmitButton>Update password</SubmitButton>
  </form>;
}