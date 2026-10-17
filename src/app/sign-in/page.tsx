import Link from "next/link";
import Image from "next/image";

import { SignInForm } from "@/components/auth/sign-in-form";

type SearchParams = Promise<{ next?: string; message?: string; error?: string }>;

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return <main className="auth-page">
    <section className="auth-panel" aria-labelledby="sign-in-title">
      <Link className="wordmark" href="/" aria-label="Schooliva home"><Image className="wordmark-logo" src="/brand/landscape_logo.png" alt="Schooliva" width={180} height={54} priority /></Link>
      <div className="auth-panel__content">
        <p className="eyebrow">Welcome back</p>
        <h1 id="sign-in-title">Sign in to Schooliva.</h1>
        <p className="auth-intro">A secure workspace for your school&apos;s people, learning, and operations.</p>
        <SignInForm nextPath={params.next} message={params.message} error={params.error} />
        <p className="auth-panel__security"><span aria-hidden="true">●</span> Secure access to your school workspace</p>
      </div>
    </section>
    <aside className="auth-aside" aria-label="Schooliva platform benefits">
      <div className="auth-aside__content">
        <span>One connected workspace</span>
        <strong>Bring your<br />school into focus.</strong>
        <p>Manage academic, administrative, and financial workflows with clarity and confidence.</p>
        <ul>
          <li><span aria-hidden="true">✓</span> Keep school operations connected</li>
          <li><span aria-hidden="true">✓</span> Access information securely</li>
          <li><span aria-hidden="true">✓</span> Make informed decisions</li>
        </ul>
      </div>
      <small>Schooliva · School management, thoughtfully connected</small>
    </aside>
  </main>;
}