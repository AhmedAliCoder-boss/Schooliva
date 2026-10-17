"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { cancelSchoolContract, createPlatformContract, pauseSchoolContract, renewSchoolContract } from "@/app/actions/admin";
import { formatCurrency } from "@/lib/format/currency";
import { formatPlatformDate } from "@/lib/format/date";

export type AdminContractRow = {
  id: string;
  contractNumber: string;
  planName: string;
  pricingModel: string;
  monthlyAmount: number;
  status: string;
  startDate: string;
  endDate: string | null;
  subscriptionValidUntil: string | null;
  renewalDate: string | null;
  schoolId: string;
  schoolName: string;
};
export type AdminContractSchoolOption = { id: string; name: string };

type StatusFilter = "all" | "active" | "draft" | "paused" | "expired" | "cancelled" | "renewal";

function dateLabel(value: string | null) {
  return value ? formatPlatformDate(value) : "Not scheduled";
}

function minimumRenewalDate(contract: AdminContractRow, asOfDate: string) {
  if (!contract.endDate || contract.endDate < asOfDate) return asOfDate;
  return new Date(Date.parse(`${contract.endDate}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
}

function csvExport(rows: AdminContractRow[]) {
  const columns = ["Contract", "School", "Plan", "Billing model", "Amount", "Status", "Start date", "Agreement end", "Paid through"];
  const data = rows.map((row) => [row.contractNumber, row.schoolName, row.planName, row.pricingModel, row.monthlyAmount, row.status, row.startDate, row.endDate ?? "", row.subscriptionValidUntil ?? row.renewalDate ?? ""]);
  const csv = [columns, ...data].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "schooliva-contract-portfolio.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminContractsWorkspace({ contracts, schools, asOfDate }: { contracts: AdminContractRow[]; schools: AdminContractSchoolOption[]; asOfDate: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const summary = useMemo(() => {
    const active = contracts.filter((contract) => contract.status === "active");
    const renewal = active.filter((contract) => contract.renewalDate && contract.renewalDate <= new Date(Date.parse(`${asOfDate}T00:00:00Z`) + 30 * 86400000).toISOString().slice(0, 10));
    return {
      active: active.length,
      monthlyRevenue: active.reduce((sum, contract) => sum + contract.monthlyAmount / (contract.pricingModel === "annual" ? 12 : 1), 0),
      renewal: renewal.length,
      attention: contracts.filter((contract) => ["draft", "paused", "expired"].includes(contract.status)).length,
      renewalIds: new Set(renewal.map((contract) => contract.id)),
    };
  }, [asOfDate, contracts]);
  const filteredContracts = contracts.filter((contract) => {
    const text = `${contract.contractNumber} ${contract.schoolName} ${contract.planName} ${contract.status}`.toLocaleLowerCase();
    const matchesText = text.includes(query.trim().toLocaleLowerCase());
    const matchesFilter = filter === "all" || (filter === "renewal" ? summary.renewalIds.has(contract.id) : contract.status === filter);
    return matchesText && matchesFilter;
  });

  return <div className="admin-portfolio">
    <section className="admin-portfolio__hero admin-portfolio__hero--contracts">
      <div><span>COMMERCIAL OPERATIONS</span><h2>Contract control room</h2><p>Manage school plans, revenue exposure, and upcoming renewals from one portfolio.</p></div>
      <Link href="#contract-create" className="admin-portfolio__hero-action">＋ Create contract</Link>
    </section>
    <section className="admin-portfolio__metrics" aria-label="Contract portfolio metrics">
      <article><span>Contracts in view</span><strong>{contracts.length}</strong><small>Latest platform records</small></article>
      <article><span>Active plans</span><strong>{summary.active}</strong><small>Currently active</small></article>
      <article><span>Monthly run rate</span><strong>{formatCurrency(summary.monthlyRevenue)}</strong><small>Annual plans normalized monthly</small></article>
      <article className={summary.renewal ? "is-attention" : ""}><span>Renewal window</span><strong>{summary.renewal}</strong><small>Due within 30 days</small></article>
    </section>

    <section className="admin-portfolio__panel" id="contract-create">
      <header className="admin-portfolio__heading"><div><span>CONTRACT SETUP</span><h2>Create a school agreement</h2><p>Assign a plan and commercial terms. A unique contract reference is generated automatically.</p></div><b>01</b></header>
      <form action={createPlatformContract} className="admin-portfolio__form">
        <label>School<select name="schoolId" required defaultValue=""><option value="" disabled>Select a school</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
        <label>Plan name<input name="planName" minLength={2} maxLength={120} placeholder="e.g. Schooliva Growth" required /></label>
        <label>Billing model<select name="pricingModel" defaultValue="monthly"><option value="monthly">Monthly</option><option value="annual">Annual</option><option value="custom">Custom</option></select></label>
        <label>Monthly equivalent<input type="number" name="monthlyAmount" min="0.01" step="0.01" required /></label>
        <label>Start date<input type="date" name="startDate" /></label>
        <label>End date<input type="date" name="endDate" /></label>
        <div className="admin-portfolio__form-note"><span>↗</span><p>Saving creates a draft agreement and the first invoice. The subscription starts only after the full invoice is paid.</p></div>
        <button type="submit" className="admin-portfolio__primary">Create contract & invoice →</button>
      </form>
    </section>

    <section className="admin-portfolio__panel">
      <header className="admin-portfolio__heading"><div><span>PORTFOLIO · {summary.attention} NEED ATTENTION</span><h2>School contracts</h2><p>Search by school, plan or reference; review status and act on renewals.</p></div><button type="button" className="admin-portfolio__secondary" onClick={() => csvExport(filteredContracts)}>Export CSV</button></header>
      <div className="admin-portfolio__toolbar">
        <label className="admin-portfolio__search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a school, plan, or contract…" /></label>
        <div className="admin-portfolio__filters" role="group" aria-label="Filter contracts">
          {(["all", "active", "renewal", "draft", "paused", "expired", "cancelled"] as const).map((item) => <button key={item} type="button" aria-pressed={filter === item} className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)}>{item === "all" ? `All (${contracts.length})` : item === "renewal" ? `Renewal (${summary.renewal})` : item[0].toUpperCase() + item.slice(1)}</button>)}
        </div>
      </div>
      <div className="admin-portfolio__table-wrap"><table className="admin-portfolio__table">
        <thead><tr><th>School / reference</th><th>Plan & billing</th><th>Value</th><th>Status</th><th>Renewal</th><th>Workflow</th></tr></thead>
        <tbody>{filteredContracts.map((contract) => <tr key={contract.id}>
          <td><Link href={`/admin/schools/${contract.schoolId}`} className="admin-portfolio__main-link">{contract.schoolName}</Link><small>{contract.contractNumber}</small></td>
          <td><strong>{contract.planName}</strong><small>{contract.pricingModel} · starts {dateLabel(contract.startDate)}</small></td>
          <td><strong>{formatCurrency(contract.monthlyAmount)}</strong><small>monthly equivalent · {contract.pricingModel}</small></td>
          <td><span className={`admin-portfolio__status status-${contract.status}`}>{contract.status.replaceAll("_", " ")}</span></td>
          <td><strong>{dateLabel(contract.subscriptionValidUntil ?? (contract.status === "active" ? contract.renewalDate : null))}</strong><small>{contract.endDate ? `Agreement ends ${dateLabel(contract.endDate)}` : "Paid-through date"}</small></td>
          <td><div className="admin-portfolio__row-actions">
            {contract.status !== "cancelled" && !(contract.endDate && contract.endDate < asOfDate && contract.pricingModel !== "custom") && <form action={renewSchoolContract}><input type="hidden" name="contractId" value={contract.id} />{contract.pricingModel === "custom" && <label className="admin-portfolio__renewal-field"><span className="admin-portfolio__sr-only">Renewal end date for {contract.contractNumber}</span><input type="date" name="renewalEndDate" min={minimumRenewalDate(contract, asOfDate)} required /></label>}<button type="submit">{contract.pricingModel === "custom" ? "Schedule custom invoice" : contract.status === "active" ? "Schedule next invoice" : "Schedule invoice"}</button></form>}
            {contract.endDate && contract.endDate < asOfDate && contract.pricingModel !== "custom" && <span className="admin-portfolio__row-document">Agreement ended</span>}
            <Link href={`/admin/contracts/${contract.id}/print`} className="admin-portfolio__row-document">Agreement</Link>
            {contract.status === "active" && <form action={pauseSchoolContract}><input type="hidden" name="contractId" value={contract.id} /><button type="submit">Pause</button></form>}
            {!["cancelled", "expired"].includes(contract.status) && <form action={cancelSchoolContract} onSubmit={(event) => { if (!window.confirm(`Cancel ${contract.contractNumber} for ${contract.schoolName}?`)) event.preventDefault(); }}><input type="hidden" name="contractId" value={contract.id} /><button type="submit" className="is-danger">Cancel</button></form>}
          </div></td>
        </tr>)}{!filteredContracts.length && <tr><td colSpan={6} className="admin-portfolio__empty">No contracts match this search or status filter.</td></tr>}</tbody>
      </table></div>
      <footer className="admin-portfolio__table-footer">Showing {filteredContracts.length} of {contracts.length} loaded contracts</footer>
    </section>
  </div>;
}
