"use client";

import Image from "next/image";
import { useActionState } from "react";

import { updateProfile } from "@/app/actions/profile";

import { SubmitButton } from "./submit-button";

export function ProfileForm({ email, fullName, username, phone, avatarUrl }: { email: string; fullName: string; username: string; phone: string; avatarUrl: string | null }) {
  const [state, action] = useActionState(updateProfile, undefined);
  return <form action={action} className="auth-form profile-form">
    {state?.error && <p className="auth-error profile-form__message" role="alert">{state.error}</p>}
    {state?.success && <p className="auth-success profile-form__message" role="status">{state.success}</p>}
    <div className="profile-form__layout">
      <section className="profile-form__identity" aria-label="Profile photo and sign-in email">
        <div className="profile-avatar-preview">{avatarUrl ? <Image src={avatarUrl} alt="" width={104} height={104} unoptimized /> : <span aria-hidden="true">{fullName.trim().charAt(0).toUpperCase() || "S"}</span>}</div>
        <strong className="profile-form__display-name">{fullName || "Your name"}</strong>
        <span className="profile-form__identity-caption">School workspace profile</span>
        <label className="profile-form__file-label" htmlFor="avatar">Upload a photo<input id="avatar" name="avatar" type="file" accept="image/png,image/jpeg,image/webp" /></label>
        <small className="profile-form__hint">JPG, PNG, or WebP - up to 5 MB</small>
        <div className="profile-form__email">
          <label htmlFor="profileEmail">Sign-in email</label>
          <input id="profileEmail" type="email" value={email} disabled />
          <small>Contact your school administrator to change this address.</small>
        </div>
      </section>
      <div className="profile-form__details">
        <div className="profile-form__section-heading">
          <h3>Personal details</h3>
          <p>This information appears on your school account.</p>
        </div>
        <div className="profile-form__fields">
          <label htmlFor="fullName">Full name<input id="fullName" name="fullName" defaultValue={fullName} autoComplete="name" required /></label>
          <label htmlFor="username">Username<input id="username" name="username" defaultValue={username} autoComplete="username" minLength={3} maxLength={30} pattern="[A-Za-z0-9._-]+" required /><small>3-30 characters; letters, numbers, dot, dash, or underscore.</small></label>
          <label htmlFor="phone">Phone number <span>(optional)</span><input id="phone" name="phone" type="tel" defaultValue={phone} autoComplete="tel" /></label>
        </div>
        <div className="profile-form__actions">
          <span>Your changes will be saved to your account.</span>
          <SubmitButton>Save changes</SubmitButton>
        </div>
      </div>
    </div>
  </form>;
}