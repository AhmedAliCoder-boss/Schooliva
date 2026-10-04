"use client";

import { useActionState } from "react";
import { useState, type FormEvent } from "react";

import { resetPassword } from "@/app/actions/auth";

import { SubmitButton } from "./submit-button";

export function AdminContactForm({ adminEmail }: { adminEmail: string | null }) {
  const [notice, setNotice] = useState("");

  function openEmailDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminEmail) return;

    const formData = new FormData(event.currentTarget);
    const subject = `Schooliva password help - ${String(formData.get("login"))}`;
    const body = [
      `Name: ${String(formData.get("name"))}`,
      `Schooliva login / User ID: ${String(formData.get("login"))}`,
      `Account email: ${String(formData.get("email"))}`,
      "",
      String(formData.get("message")),
    ].join("\n");
    window.location.href = `mailto:${adminEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setNotice("Your email app should open with the request ready. Review it and send it to the admin.");
  }

  return <form onSubmit={openEmailDraft} className="auth-form">
    <label htmlFor="contactName">Your name<input id="contactName" name="name" autoComplete="name" maxLength={120} required /></label>
    <label htmlFor="loginId">Schooliva login / User ID<input id="loginId" name="login" autoComplete="username" maxLength={120} required /></label>
    <label htmlFor="contactEmail">Your email<input id="contactEmail" name="email" type="email" autoComplete="email" maxLength={254} required /></label>
    <label htmlFor="contactMessage">Message<textarea id="contactMessage" name="message" rows={4} maxLength={1000} defaultValue="I cannot sign in and need help accessing my account." required /></label>
    {!adminEmail && <p className="auth-error">Admin contact is not configured. Please ask your school administrator for help.</p>}
    {notice && <p className="auth-success" role="status">{notice}</p>}
    <SubmitButton disabled={!adminEmail}>Contact administrator</SubmitButton>
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