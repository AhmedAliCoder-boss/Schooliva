import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/password-forms";

export default function ForgotPasswordPage() {
  return <main className="auth-page"><section className="auth-panel">
    <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
    <p className="eyebrow">Account recovery</p><h1>Reset your password.</h1>
    <p className="auth-intro">Enter your account email and we will send a secure recovery link.</p>
    <ForgotPasswordForm /><Link className="auth-link auth-back" href="/sign-in">Back to sign in</Link>
  </section><div className="auth-aside"><span>02 / recovery</span><strong>Back to<br />what matters.</strong></div></main>;
}