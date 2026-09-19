"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createAccount } from "@/app/actions/auth";

import { SubmitButton } from "./submit-button";

export function CreateAccountForm() {
  const [state, action] = useActionState(createAccount, undefined);

  return (
    <form action={action} className="auth-form">
      {state?.error && <p className="auth-error">{state.error}</p>}
      {state?.success && <p className="auth-success">{state.success}</p>}
      <label htmlFor="fullName">Full name<input id="fullName" name="fullName" autoComplete="name" required /></label>
      {state?.fieldErrors?.fullName && <p className="field-error">{state.fieldErrors.fullName[0]}</p>}
      <label htmlFor="username">Username<input id="username" name="username" autoComplete="username" required /></label>
      {state?.fieldErrors?.username && <p className="field-error">{state.fieldErrors.username[0]}</p>}
      <label htmlFor="email">Email<input id="email" name="email" type="email" autoComplete="email" required /></label>
      {state?.fieldErrors?.email && <p className="field-error">{state.fieldErrors.email[0]}</p>}
      <label htmlFor="password">Password<input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      {state?.fieldErrors?.password && <p className="field-error">{state.fieldErrors.password[0]}</p>}
      <SubmitButton>Create account</SubmitButton>
      <Link className="auth-link" href="/sign-in">Already have an account? Sign in</Link>
    </form>
  );
}