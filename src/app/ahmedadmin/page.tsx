import Image from "next/image";
import Link from "next/link";

import { CreateAccountForm } from "@/components/auth/create-account-form";

export default function AhmedAdminPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand-logo" href="/" aria-label="Schooliva home">
          <Image src="/brand/logo.png" alt="Schooliva" width={220} height={80} priority />
        </Link>
        <p className="eyebrow">Account request</p>
        <h1>Create an account.</h1>
        <p className="auth-intro">Create a principal or staff account. Admin and super-admin accounts can only be provisioned through a protected developer workflow.</p>
        <CreateAccountForm />
      </section>
      <div className="auth-aside"><span>01 / account</span><strong>Start your school,<br />in focus.</strong></div>
    </main>
  );
}