import Link from "next/link";
import Image from "next/image";

import { SignInForm } from "@/components/auth/sign-in-form";

type SearchParams = Promise<{ next?: string; message?: string; error?: string }>;

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return <main className="auth-page"><section className="auth-panel">
    <Link className="wordmark" href="/" aria-label="Schooliva home"><Image className="wordmark-logo" src="/brand/logo.png" alt="Schooliva" width={180} height={54} priority /></Link>
    <p className="eyebrow">Welcome back</p><h1>Sign in to Schooliva.</h1>
    <p className="auth-intro">School operations, clearly managed.</p>
    <SignInForm nextPath={params.next} message={params.message} error={params.error} />
  </section><div className="auth-aside"><span>01 / access</span><strong>Your school,<br />in focus.</strong></div></main>;
}