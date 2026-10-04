import Link from "next/link";

import { AdminContactForm } from "@/components/auth/password-forms";

export default function ForgotPasswordPage() {
  const configuredAdminEmail = process.env.ADMIN_CONTACT_EMAIL?.trim();
  const adminEmail = configuredAdminEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredAdminEmail)
    ? configuredAdminEmail
    : null;

  return <main className="auth-page"><section className="auth-panel">
    <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
    <p className="eyebrow">Account support</p><h1>Need sign-in help?</h1>
    <p className="auth-intro">Fill in this form to prepare a message for your administrator. Do not include your password.</p>
    <AdminContactForm adminEmail={adminEmail} /><Link className="auth-link auth-back" href="/sign-in">Back to sign in</Link>
  </section><div className="auth-aside"><span>02 / recovery</span><strong>Back to<br />what matters.</strong></div></main>;
}