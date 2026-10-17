"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { createSchoolTrial, updateSchoolTrial } from "@/app/actions/admin";

export type AdminTrialRow = {
  id: string;
  trialName: string;
  schoolId: string;
  schoolName: string;
  status: string;
  startsOn: string;
  endsOn: string;
  seats: number;
  notes: string | null;
};

type TrialFilter = "all" | "active" | "pending" | "expiring" | "expired" | "converted";

function daysRemaining(endsOn: string, asOfDate: string) {
  return Math.ceil((Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${asOfDate}T00:00:00Z`)) / 86400000);
}

export function AdminTrialsWorkspace({
  trials,
  schools,
  asOfDate,
}: {
  trials: AdminTrialRow[];
  schools: Array<{ id: string; name: string }>;
  asOfDate: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TrialFilter>("all");
  const summary = useMemo(() => ({
    active: trials.filter((trial) => trial.status === "active" && trial.endsOn >= asOfDate).length,
    pending: trials.filter((trial) => trial.status === "pending").length,
    expiring: trials.filter((trial) => trial.status === "active" && trial.endsOn >= asOfDate && daysRemaining(trial.endsOn, asOfDate) <= 7).length,
    expired: trials.filter((trial) => trial.status === "expired" || (trial.status === "active" && trial.endsOn < asOfDate)).length,
    seats: trials.filter((trial) => trial.status === "active").reduce((sum, trial) => sum + trial.seats, 0),
  }), [asOfDate, trials]);
  const visibleTrials = trials.filter((trial) => {
    const searchMatch = `${trial.trialName} ${trial.schoolName} ${trial.status} ${trial.notes ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    const remaining = daysRemaining(trial.endsOn, asOfDate);
    const statusMatch = filter === "all" ||
      (filter === "expiring" ? trial.status === "active" && remaining >= 0 && remaining <= 7 :
        filter === "expired" ? trial.status === "expired" || (trial.status === "active" && remaining < 0) :
          trial.status === filter);
    return searchMatch && statusMatch;
  });

  return <div className="admin-portfolio">
    <section className="admin-portfolio__hero admin-portfolio__hero--trials">
      <div><span>ONBOARDING & CONVERSION</span><h2>Trial success workspace</h2><p>Keep pilots on track, spot trials nearing expiry, and move qualified schools into a live contract.</p></div>
      <a href="#trial-create" className="admin-portfolio__hero-action">＋ Launch a trial</a>
    </section>
    <section className="admin-portfolio__metrics" aria-label="Trial portfolio metrics">
      <article><span>Active trials</span><strong>{summary.active}</strong><small>{summary.seats.toLocaleString()} seats allocated</small></article>
      <article><span>Pending onboarding</span><strong>{summary.pending}</strong><small>Awaiting trial activation</small></article>
      <article className={summary.expiring ? "is-attention" : ""}><span>Expiring this week</span><strong>{summary.expiring}</strong><small>Prioritize school follow-up</small></article>
      <article><span>Expired / past due</span><strong>{summary.expired}</strong><small>Review conversion outcome</small></article>
    </section>
    <section className="admin-portfolio__panel" id="trial-create">
      <header className="admin-portfolio__heading"><div><span>ONBOARDING · STEP 1</span><h2>Set up a school pilot</h2><p>Choose the school, trial window, seat allocation, and handoff notes.</p></div><b>01</b></header>
      <form action={createSchoolTrial} className="admin-portfolio__form admin-portfolio__form--trial">
        <label>School<select name="schoolId" required defaultValue=""><option value="" disabled>Select a school</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
        <label>Trial name<input name="trialName" minLength={2} maxLength={120} placeholder="e.g. Autumn onboarding" required /></label>
        <label>Status<select name="status" defaultValue="pending"><option value="pending">Pending</option><option value="active">Active now</option></select></label>
        <label>Start date<input type="date" name="startsOn" defaultValue={asOfDate} /></label>
        <label>End date<input type="date" name="endsOn" required /></label>
        <label>Seat allocation<input type="number" name="seats" min="1" max="100000" defaultValue="25" required /></label>
        <label className="admin-portfolio__form-wide">Success plan / notes<textarea name="notes" maxLength={2000} rows={2} placeholder="Onboarding goals, owners, or next steps…" /></label>
        <button type="submit" className="admin-portfolio__primary">Create trial →</button>
      </form>
    </section>
    <section className="admin-portfolio__panel">
      <header className="admin-portfolio__heading"><div><span>TRIAL PIPELINE</span><h2>Manage pilots</h2><p>Update trial progress, seats, notes, and end dates; use the school record for conversion.</p></div></header>
      <div className="admin-portfolio__toolbar">
        <label className="admin-portfolio__search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search school, trial, or notes…" /></label>
        <div className="admin-portfolio__filters" role="group" aria-label="Filter trials">{(["all", "active", "pending", "expiring", "expired", "converted"] as const).map((item) => <button key={item} type="button" aria-pressed={filter === item} className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)}>{item === "all" ? `All (${trials.length})` : item === "expiring" ? `Expiring (${summary.expiring})` : item[0].toUpperCase() + item.slice(1)}</button>)}</div>
      </div>
      <div className="admin-trial-list">{visibleTrials.map((trial) => {
        const days = daysRemaining(trial.endsOn, asOfDate);
        const remaining = trial.status === "active" ? Math.max(0, Math.min(100, Math.round((1 - days / Math.max(1, Math.ceil((Date.parse(`${trial.endsOn}T00:00:00Z`) - Date.parse(`${trial.startsOn}T00:00:00Z`)) / 86400000))) * 100))) : 0;
        const expired = days < 0 && trial.status === "active";
        return <article className={`admin-trial-card${expired || days <= 7 && trial.status === "active" ? " is-attention" : ""}`} key={trial.id}>
          <div className="admin-trial-card__top"><div><span className={`admin-portfolio__status status-${expired ? "expired" : trial.status}`}>{expired ? "past due" : trial.status}</span><h3>{trial.trialName}</h3><Link href={`/admin/schools/${trial.schoolId}`}>{trial.schoolName} <span aria-hidden="true">↗</span></Link></div><div className="admin-trial-card__seats"><strong>{trial.seats}</strong><small>seats</small></div></div>
          <div className="admin-trial-card__timeline"><div><span>Started</span><strong>{trial.startsOn}</strong></div><div><span>{expired ? "Ended" : "Days remaining"}</span><strong>{trial.status === "active" ? expired ? `${Math.abs(days)} days ago` : days === 0 ? "Ends today" : `${days} days` : trial.endsOn}</strong></div></div>
          {trial.status === "active" && <div className="admin-trial-card__progress" role="progressbar" aria-label="Trial time elapsed" aria-valuenow={remaining} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${remaining}%` }} /></div>}
          <div className="admin-trial-card__documents"><Link href={`/admin/trials/${trial.id}/print`}>Print trial summary ↗</Link></div>
          {trial.status === "converted" ? <p className="admin-trial-card__converted">Converted to a live contract. Manage the agreement in <Link href="/admin/contracts">Contracts</Link>.</p> : <><Link className="admin-trial-card__convert" href={`/admin/schools/${trial.schoolId}`}>Review / prepare contract →</Link><details className="admin-trial-card__edit"><summary>Update trial details <span aria-hidden="true">⌄</span></summary><form action={updateSchoolTrial}>
            <input type="hidden" name="trialId" value={trial.id} />
            <label>Status<select name="status" defaultValue={trial.status}><option value="pending">Pending</option><option value="active">Active</option><option value="expired">Expired</option></select></label>
            <label>End date<input type="date" name="endsOn" defaultValue={trial.endsOn} required /></label>
            <label>Seat allocation<input type="number" name="seats" min="1" max="100000" defaultValue={trial.seats} required /></label>
            <label className="admin-portfolio__form-wide">Notes<textarea name="notes" maxLength={2000} rows={2} defaultValue={trial.notes ?? ""} /></label>
            <button className="admin-portfolio__primary" type="submit">Save trial update</button>
          </form></details></>}
        </article>;
      })}{!visibleTrials.length && <div className="admin-portfolio__empty">No trials match this search or status filter.</div>}</div>
    </section>
  </div>;
}
