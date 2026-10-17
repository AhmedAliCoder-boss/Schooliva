import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintAction } from "@/components/print/print-action";
import { requireMasterAdmin } from "@/lib/admin/guard";

type Params = Promise<{ trialId: string }>;

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-PK", { dateStyle: "long", timeZone: "UTC" }).format(date);
}

export default async function PlatformTrialPrintPage({ params }: { params: Params }) {
  const { trialId } = await params;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(trialId)) notFound();

  const { supabase } = await requireMasterAdmin();
  const { data: trial, error: trialError } = await supabase.from("school_trials")
    .select("id,school_id,trial_name,status,starts_on,ends_on,seats,notes")
    .eq("id", trialId)
    .maybeSingle();
  if (trialError) throw new Error("School trial could not be loaded for printing.");
  if (!trial) notFound();

  const { data: school, error: schoolError } = await supabase.from("schools")
    .select("name,code,email,phone,address,city,state,country")
    .eq("id", trial.school_id)
    .maybeSingle();
  if (schoolError) throw new Error("School details could not be loaded for the trial document.");
  if (!school) notFound();

  return <main className="school-document-page platform-bill-print-page">
    <div className="school-document-toolbar no-print">
      <Link href="/admin/trials">← Back to trials</Link>
      <PrintAction label="Print trial summary / Save PDF" />
    </div>
    <article className="platform-contract-document platform-trial-document">
      <header className="platform-contract-document__header">
        <div><Image src="/brand/landscape_logo.png" alt="Schooliva" width={190} height={56} priority /><span>School management, clearly managed.</span></div>
        <div><span>SCHOOLIVA PLATFORM</span><h1>TRIAL ACTIVATION SUMMARY</h1><strong>{trial.trial_name}</strong></div>
      </header>
      <section className="platform-contract-document__parties">
        <div><span>TRIAL SCHOOL</span><h2>{school.name}</h2><p>School code: {school.code}</p><p>{[school.address, school.city, school.state, school.country].filter(Boolean).join(", ")}</p>{(school.email || school.phone) && <p>{[school.email, school.phone].filter(Boolean).join(" · ")}</p>}</div>
        <div><span>TRIAL STATUS</span><h2>{trial.status.replaceAll("_", " ")}</h2><p>{trial.seats.toLocaleString()} allocated users</p></div>
      </section>
      <section className="platform-contract-document__terms">
        <h2>Trial period</h2>
        <dl>
          <div><dt>Trial starts</dt><dd>{formatDate(trial.starts_on)}</dd></div>
          <div><dt>Trial ends</dt><dd>{formatDate(trial.ends_on)}</dd></div>
          <div><dt>Seat allocation</dt><dd>{trial.seats.toLocaleString()}</dd></div>
          <div><dt>Current status</dt><dd className="is-status">{trial.status}</dd></div>
        </dl>
        <p>Trial access ends at the close of the listed end date. After expiry, school users cannot sign in until a contract invoice is fully paid and the subscription is activated. This summary is an operational record and does not replace a signed commercial contract.</p>
        {trial.notes && <div className="platform-trial-document__notes"><strong>Onboarding notes</strong><p>{trial.notes}</p></div>}
      </section>
      <footer className="platform-contract-document__footer"><strong>Schooliva Platform</strong><span>Trial record for {school.code}</span></footer>
    </article>
  </main>;
}
