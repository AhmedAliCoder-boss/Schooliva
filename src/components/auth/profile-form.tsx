"use client";

import Image from "next/image";
import { useActionState } from "react";

import { updateProfile } from "@/app/actions/profile";

import { SubmitButton } from "./submit-button";

export function ProfileForm({ email, fullName, username, phone, avatarUrl }: { email: string; fullName: string; username: string; phone: string; avatarUrl: string | null }) {
  const [state, action] = useActionState(updateProfile, undefined);
  return <form action={action} className="auth-form profile-form">
    {state?.error && <p className="auth-error">{state.error}</p>}
    {state?.success && <p className="auth-success">{state.success}</p>}
    <div className="profile-avatar-preview">{avatarUrl ? <Image src={avatarUrl} alt="Your profile" width={96} height={96} unoptimized /> : <span aria-hidden="true">{fullName.trim().charAt(0).toUpperCase() || "S"}</span>}</div>
    <label>Email<input type="email" value={email} disabled /></label>
    <label htmlFor="fullName">Full name<input id="fullName" name="fullName" defaultValue={fullName} required /></label>
    <label htmlFor="username">Username<input id="username" name="username" defaultValue={username} minLength={3} maxLength={30} pattern="[A-Za-z0-9._-]+" required /></label>
    <label htmlFor="phone">Phone<input id="phone" name="phone" defaultValue={phone} /></label>
    <label htmlFor="avatar">Profile photo<input id="avatar" name="avatar" type="file" accept="image/png,image/jpeg,image/webp" /></label>
    <SubmitButton>Save profile</SubmitButton>
  </form>;
}