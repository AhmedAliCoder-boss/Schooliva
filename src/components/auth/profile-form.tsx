"use client";

import { useActionState } from "react";

import { updateProfile } from "@/app/actions/profile";

import { SubmitButton } from "./submit-button";

export function ProfileForm({ email, fullName, phone }: { email: string; fullName: string; phone: string }) {
  const [state, action] = useActionState(updateProfile, undefined);
  return <form action={action} className="auth-form profile-form">
    {state?.error && <p className="auth-error">{state.error}</p>}
    {state?.success && <p className="auth-success">{state.success}</p>}
    <label>Email<input type="email" value={email} disabled /></label>
    <label htmlFor="fullName">Full name<input id="fullName" name="fullName" defaultValue={fullName} required /></label>
    <label htmlFor="phone">Phone<input id="phone" name="phone" defaultValue={phone} /></label>
    <SubmitButton>Save profile</SubmitButton>
  </form>;
}