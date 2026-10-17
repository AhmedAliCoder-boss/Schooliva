"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { sendPlatformAnnouncement } from "@/app/actions/platform-notifications";
import { formatPlatformDate } from "@/lib/format/date";

type School = { id: string; name: string; isActive: boolean };
type AudienceRole = { schoolId: string; slug: string; name: string; recipientCount: number };
type Campaign = {
  id: string;
  title: string;
  message: string;
  roleSlugs: string[];
  schoolIds: string[];
  recipientCount: number;
  createdAt: string;
  readCount: number;
};

type CampaignFilter = "all" | "opened" | "unopened";

const templates = {
  custom: { label: "Start from scratch", title: "", message: "" },
  operations: { label: "Platform operations", title: "Important platform update", message: "We are sharing an important update about Schooliva. Please review the details below and share them with the relevant members of your school." },
  billing: { label: "Billing reminder", title: "Schooliva billing reminder", message: "This is a reminder to review your Schooliva account billing details. Please contact the Schooliva support team if you need assistance." },
  maintenance: { label: "Maintenance notice", title: "Scheduled platform maintenance", message: "Schooliva will undergo scheduled maintenance. Some platform features may be temporarily unavailable during this period. Thank you for your understanding." },
  urgent: { label: "Urgent action required", title: "Action required for your school", message: "Please review this important notice and complete any required action as soon as possible." },
} as const;

function SendButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="platform-notifications__send" disabled={pending}>{pending ? "Sending campaign…" : "Send campaign now"}<span aria-hidden="true">→</span></button>;
}

function downloadCsv(campaigns: Campaign[]) {
  const columns = ["Title", "Message", "Schools", "Roles", "Recipients", "Read", "Created"];
  const values = campaigns.map((campaign) => [
    campaign.title,
    campaign.message,
    campaign.schoolIds.length,
    campaign.roleSlugs.join(", "),
    campaign.recipientCount,
    campaign.readCount,
    campaign.createdAt,
  ]);
  const csv = [columns, ...values].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "schooliva-notification-campaigns.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PlatformNotificationWorkspace({
  schools,
  audienceRoles,
  campaigns,
}: {
  schools: School[];
  audienceRoles: AudienceRole[];
  campaigns: Campaign[];
}) {
  const [result, action] = useActionState(sendPlatformAnnouncement, undefined);
  const [schoolQuery, setSchoolQuery] = useState("");
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [template, setTemplate] = useState<keyof typeof templates>("custom");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [confirmedCampaigns, setConfirmedCampaigns] = useState<Record<string, boolean>>({});
  const [campaignQuery, setCampaignQuery] = useState("");
  const [campaignFilter, setCampaignFilter] = useState<CampaignFilter>("all");

  const confirmationKey = result?.campaignId ?? "draft";
  const confirmed = confirmedCampaigns[confirmationKey] ?? false;
  const activeSchools = schools.filter((school) => school.isActive);
  const roles = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const role of audienceRoles) {
      const current = counts.get(role.slug);
      counts.set(role.slug, { name: role.name, count: (current?.count ?? 0) + role.recipientCount });
    }
    return [...counts.entries()].map(([slug, role]) => ({ slug, ...role })).sort((a, b) => a.name.localeCompare(b.name));
  }, [audienceRoles]);

  const selectedSchoolSet = useMemo(() => new Set(selectedSchools), [selectedSchools]);
  const selectedRoleSet = useMemo(() => new Set(selectedRoles), [selectedRoles]);
  const estimatedRoleMatches = audienceRoles.reduce((sum, role) =>
    selectedSchoolSet.has(role.schoolId) && selectedRoleSet.has(role.slug) ? sum + role.recipientCount : sum, 0);
  const visibleSchools = activeSchools.filter((school) => school.name.toLocaleLowerCase().includes(schoolQuery.trim().toLocaleLowerCase()));
  const visibleCampaigns = campaigns.filter((campaign) => {
    const text = `${campaign.title} ${campaign.message} ${campaign.roleSlugs.join(" ")} ${campaign.schoolIds.map((id) => schools.find((school) => school.id === id)?.name ?? "").join(" ")}`.toLocaleLowerCase();
    const queryMatch = text.includes(campaignQuery.trim().toLocaleLowerCase());
    const engagementMatch = campaignFilter === "all" || (campaignFilter === "opened" ? campaign.readCount > 0 : campaign.readCount === 0);
    return queryMatch && engagementMatch;
  });
  const deliveredCount = campaigns.reduce((sum, campaign) => sum + campaign.recipientCount, 0);
  const openedCount = campaigns.reduce((sum, campaign) => sum + campaign.readCount, 0);
  const openRate = deliveredCount ? Math.round((openedCount / deliveredCount) * 100) : 0;

  function toggleSchool(id: string) {
    setSelectedSchools((current) => current.includes(id) ? current.filter((schoolId) => schoolId !== id) : [...current, id]);
  }

  function toggleRole(slug: string) {
    setSelectedRoles((current) => current.includes(slug) ? current.filter((roleSlug) => roleSlug !== slug) : [...current, slug]);
  }

  function selectTemplate(value: keyof typeof templates) {
    setTemplate(value);
    setTitle(templates[value].title);
    setMessage(templates[value].message);
  }

  return <div className="platform-notifications">
    <section className="platform-notifications__hero">
      <div><span className="platform-notifications__eyebrow">SCHOOLIVA · PLATFORM COMMUNICATIONS</span><h2>One message. Every school.</h2><p>Coordinate trusted in-app announcements across your school network, target the right teams, and monitor readership from one control room.</p></div>
      <div className="platform-notifications__hero-mark" aria-hidden="true"><span>✦</span><small>MASTER<br />CONTROL</small></div>
      <div className="platform-notifications__hero-meta"><span><i /> Delivery channel</span><strong>In-app · role-targeted</strong></div>
    </section>

    <section className="platform-notifications__metrics" aria-label="Campaign summary">
      <article><span>Active schools</span><strong>{activeSchools.length}</strong><small>Available for platform-wide outreach</small></article>
      <article><span>Campaigns tracked</span><strong>{campaigns.length}</strong><small>Latest platform sends</small></article>
      <article><span>Recipients reached</span><strong>{deliveredCount.toLocaleString()}</strong><small>Across the campaigns shown</small></article>
      <article><span>Read rate</span><strong>{openRate}%</strong><small>{openedCount.toLocaleString()} recipient inboxes opened</small></article>
    </section>

    <section className="platform-notifications__composer">
      <header className="platform-notifications__section-heading"><div><span>CAMPAIGN STUDIO · STEP 1</span><h2>Compose and target</h2><p>Choose active schools and school roles. Recipients who opted out of in-app announcements are excluded.</p></div><b>01 / 03</b></header>
      <form action={action}>
        {selectedSchools.map((schoolId) => <input key={schoolId} type="hidden" name="schoolIds" value={schoolId} />)}
        <div className="platform-notifications__form-grid">
          <fieldset className="platform-notifications__audience">
            <legend><span>01</span> Select schools <b>{selectedSchools.length} selected</b></legend>
            <div className="platform-notifications__select-tools">
              <label><span className="platform-notifications__sr-only">Search active schools</span><input type="search" value={schoolQuery} onChange={(event) => setSchoolQuery(event.target.value)} placeholder="Find a school…" /></label>
              <button type="button" onClick={() => setSelectedSchools(activeSchools.map((school) => school.id))}>Select all</button>
              <button type="button" onClick={() => setSelectedSchools([])}>Clear</button>
            </div>
            <div className="platform-notifications__school-list">
              {visibleSchools.map((school) => <label key={school.id} className={selectedSchoolSet.has(school.id) ? "is-selected" : ""}>
                <input type="checkbox" value={school.id} checked={selectedSchoolSet.has(school.id)} onChange={() => toggleSchool(school.id)} />
                <span className="platform-notifications__school-avatar" aria-hidden="true">{school.name.slice(0, 1).toUpperCase()}</span>
                <span><strong>{school.name}</strong><small>Active school</small></span>
                <i aria-hidden="true">{selectedSchoolSet.has(school.id) ? "✓" : "+"}</i>
              </label>)}
              {!visibleSchools.length && <p className="platform-notifications__empty">No active schools match your search.</p>}
            </div>
          </fieldset>

          <div className="platform-notifications__message-column">
            <fieldset className="platform-notifications__roles">
              <legend><span>02</span> Choose recipient roles <b>{selectedRoles.length} selected</b></legend>
              <div className="platform-notifications__role-list">
                {roles.map((role) => <label key={role.slug} className={selectedRoleSet.has(role.slug) ? "is-selected" : ""}>
                  <input type="checkbox" name="roleSlugs" value={role.slug} checked={selectedRoleSet.has(role.slug)} onChange={() => toggleRole(role.slug)} />
                  <span><strong>{role.name}</strong><small>{role.count.toLocaleString()} role matches across all active schools</small></span>
                  <i aria-hidden="true">{selectedRoleSet.has(role.slug) ? "✓" : "+"}</i>
                </label>)}
                {!roles.length && <p className="platform-notifications__empty">No active school roles are available.</p>}
              </div>
              <small className="platform-notifications__hint">A person with multiple selected roles receives one copy per school.</small>
            </fieldset>
            <div className="platform-notifications__message">
              <label className="platform-notifications__field">Message template<select value={template} onChange={(event) => selectTemplate(event.target.value as keyof typeof templates)}>{Object.entries(templates).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label>
              <label className="platform-notifications__field">Campaign title<input name="title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} placeholder="Add a clear, recognizable title" /></label>
              <label className="platform-notifications__field">Message<textarea name="message" value={message} onChange={(event) => setMessage(event.target.value)} required maxLength={1200} rows={5} placeholder="Write the information recipients need to know…" /><small>{message.length} / 1,200</small></label>
            </div>
          </div>
        </div>

        <div className="platform-notifications__review">
          <div className="platform-notifications__reach"><span aria-hidden="true">◎</span><div><strong>Audience estimate</strong><p>{selectedSchools.length} schools · {selectedRoles.length} roles · <b>{estimatedRoleMatches.toLocaleString()} role matches</b></p></div></div>
          <label className="platform-notifications__confirm"><input type="checkbox" name="confirmSend" value="yes" checked={confirmed} onChange={(event) => setConfirmedCampaigns((current) => ({ ...current, [confirmationKey]: event.target.checked }))} required /><span>I reviewed the selected schools, roles, and message. Send this campaign immediately.</span></label>
          <SendButton />
        </div>
        {result?.error && <p className="platform-notifications__feedback is-error" role="alert">{result.error}</p>}
        {result?.success && <p className="platform-notifications__feedback is-success" role="status">{result.success}</p>}
      </form>
    </section>

    <section className="platform-notifications__campaigns">
      <header className="platform-notifications__section-heading"><div><span>CAMPAIGN STUDIO · STEP 2</span><h2>Delivery & readership</h2><p>Review recent sends and see how many recipient inboxes opened each campaign.</p></div><button type="button" className="platform-notifications__export" onClick={() => downloadCsv(visibleCampaigns)}>Export CSV</button></header>
      <div className="platform-notifications__history-tools">
        <label><span className="platform-notifications__sr-only">Search campaigns</span><input type="search" value={campaignQuery} onChange={(event) => setCampaignQuery(event.target.value)} placeholder="Search title, school, or role…" /></label>
        <div role="group" aria-label="Filter campaigns by readership">{(["all", "opened", "unopened"] as const).map((filter) => <button type="button" key={filter} aria-pressed={campaignFilter === filter} className={campaignFilter === filter ? "is-active" : ""} onClick={() => setCampaignFilter(filter)}>{filter === "all" ? "All sends" : filter === "opened" ? "Opened" : "Not opened"}</button>)}</div>
        <span>{visibleCampaigns.length} of {campaigns.length} campaigns</span>
      </div>
      <div className="platform-notifications__table-wrap"><table className="platform-notifications__table">
        <thead><tr><th>Campaign</th><th>Schools</th><th>Roles</th><th>Reached</th><th>Readership</th><th>Sent</th></tr></thead>
        <tbody>{visibleCampaigns.map((campaign) => {
          const percent = campaign.recipientCount ? Math.round(campaign.readCount / campaign.recipientCount * 100) : 0;
          const schoolNames = campaign.schoolIds.map((id) => schools.find((school) => school.id === id)?.name).filter(Boolean);
          return <tr key={campaign.id}>
            <td><strong>{campaign.title}</strong><small>{campaign.message}</small></td>
            <td><strong>{schoolNames.length} schools</strong><small>{schoolNames.slice(0, 2).join(", ")}{schoolNames.length > 2 ? ` +${schoolNames.length - 2} more` : ""}</small></td>
            <td><div className="platform-notifications__chips">{campaign.roleSlugs.map((slug) => <span key={slug}>{roles.find((role) => role.slug === slug)?.name ?? slug.replaceAll("_", " ")}</span>)}</div></td>
            <td><strong>{campaign.recipientCount.toLocaleString()}</strong><small>in-app notifications</small></td>
            <td><strong>{percent}%</strong><small>{campaign.readCount.toLocaleString()} opened</small><span className="platform-notifications__progress"><i style={{ width: `${percent}%` }} /></span></td>
            <td><time dateTime={campaign.createdAt}>{formatPlatformDate(campaign.createdAt, true)}</time></td>
          </tr>;
        })}{!visibleCampaigns.length && <tr><td colSpan={6} className="platform-notifications__empty">{campaigns.length ? "No campaigns match your search and readership filters." : "No platform campaigns have been sent yet."}</td></tr>}</tbody>
      </table></div>
    </section>
    <footer className="platform-notifications__footnote"><span aria-hidden="true">ⓘ</span><p>Delivery is in-app only. Active profiles with matching school roles receive the campaign unless they opted out. Readership counts reflect recipients who opened the notification.</p></footer>
  </div>;
}
