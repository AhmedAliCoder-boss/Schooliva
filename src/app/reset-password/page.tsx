import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/password-forms";

export default function ResetPasswordPage() {
  return <main className="auth-page"><section className="auth-panel">
    <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
    <p className="eyebrow">Secure recovery</p><h1>Create a new password.</h1>
    <p className="auth-intro">Choose a strong password you have not used before.</p>
    <ResetPasswordForm />
  </section><div className="auth-aside"><span>03 / secure</span><strong>A fresh start<br />for your account.</strong></div></main>;
}