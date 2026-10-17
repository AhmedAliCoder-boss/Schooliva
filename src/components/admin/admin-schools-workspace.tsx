"use client";

import Link from "next/link";
import { useState } from "react";

import { setMasterAdminSchoolStatus } from "@/app/actions/admin";
import { formatPlatformDate } from "@/lib/format/date";

export type AdminSchoolPortfolioRow = {
  id: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  accounts: number;
  students: number;
  storageBytes: number;
  lifecycle: string;
  planName: string;
};

function formatBytes(value: number) {
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(value / 1024)} KB`;
}

function exportSchools(schools: AdminSchoolPortfolioRow[]) {
  const columns = ["School", "Code", "Email", "Phone", "Status", "Lifecycle", "Plan", "Accounts", "Students", "Storage", "Created"];
  const data = schools.map((school) => [school.name, school.code, school.email ?? "", school.phone ?? "", school.isActive ? "Active" : "Inactive", school.lifecycle, school.planName, school.accounts, school.students, school.storageBytes, school.createdAt]);
  const csv = [columns, ...data].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "schooliva-school-portfolio.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminSchoolsWorkspace({
  schools,
  totalCount,
  activeCount,
  search,
  status,
  page,
  pageSize,
  filteredCount,
}: {
  schools: AdminSchoolPortfolioRow[];
  totalCount: number;
  activeCount: number;
  search: string;
  status: string;
  page: number;
  pageSize: number;
  filteredCount: number;
}) {
  const [query, setQuery] = useState("");
  const filteredSchools = schools.filter((school) => `${school.name} ${school.code} ${school.email ?? ""} ${school.planName} ${school.lifecycle}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const inactiveCount = totalCount - activeCount;
  const pageHref = (nextPage: number) => `/admin/schools?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&page=${nextPage}`;

  return <div className="admin-portfolio">
    <section className="admin-portfolio__hero admin-portfolio__hero--schools">
      <div><span>TENANT OPERATIONS</span><h2>School portfolio command center</h2><p>Monitor each school’s lifecycle, scale, and platform status. Open the tenant record for deeper management or access its dashboard deliberately.</p></div>
      <Link href="/admin/schools/new" className="admin-portfolio__hero-action">＋ Create school</Link>
    </section>
    <section className="admin-portfolio__metrics" aria-label="School portfolio metrics">
      <article><span>Schools in portfolio</span><strong>{totalCount}</strong><small>All registered tenants</small></article>
      <article><span>Active schools</span><strong>{activeCount}</strong><small>Platform access enabled</small></article>
      <article className={inactiveCount ? "is-attention" : ""}><span>Inactive schools</span><strong>{inactiveCount}</strong><small>Review account status</small></article>
      <article><span>Current page</span><strong>{schools.length}</strong><small>of {filteredCount} matching records</small></article>
    </section>
    <section className="admin-portfolio__panel">
      <header className="admin-portfolio__heading"><div><span>TENANT DIRECTORY</span><h2>All schools</h2><p>Search, filter, export, and manage access to school workspaces.</p></div><button type="button" className="admin-portfolio__secondary" onClick={() => exportSchools(filteredSchools)}>Export visible CSV</button></header>
      <form className="admin-portfolio__toolbar admin-portfolio__server-filters" method="get">
        <label className="admin-portfolio__search"><span aria-hidden="true">⌕</span><input name="search" defaultValue={search} placeholder="Search name, code, or email…" /></label>
        <select name="status" defaultValue={status} aria-label="Filter schools by status"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        <button className="admin-portfolio__filter-submit" type="submit">Apply filters</button>
        <label className="admin-portfolio__search admin-portfolio__local-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter this page…" /></label>
      </form>
      <div className="admin-portfolio__table-wrap"><table className="admin-portfolio__table admin-portfolio__table--schools">
        <thead><tr><th>School</th><th>Lifecycle</th><th>Scale</th><th>Storage</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>{filteredSchools.map((school) => <tr key={school.id}>
          <td><Link href={`/admin/schools/${school.id}`} className="admin-portfolio__main-link">{school.name}</Link><small>{school.code} · {school.email ?? school.phone ?? "No contact details"}</small></td>
          <td><strong>{school.lifecycle}</strong><small>{school.planName}</small></td>
          <td><strong>{school.accounts} accounts</strong><small>{school.students} students</small></td>
          <td><strong>{formatBytes(school.storageBytes)}</strong><small>recorded documents</small></td>
          <td><span className={`admin-portfolio__status ${school.isActive ? "status-active" : "status-inactive"}`}>{school.isActive ? "Active" : "Inactive"}</span></td>
          <td><time dateTime={school.createdAt}>{formatPlatformDate(school.createdAt)}</time></td>
          <td><div className="admin-portfolio__row-actions">
            <Link href={`/admin/schools/${school.id}`}>Manage</Link>
            <Link href={`/admin/schools/${school.id}/dashboard`}>Open dashboard</Link>
            <form action={setMasterAdminSchoolStatus} onSubmit={(event) => { if (!window.confirm(`${school.isActive ? "Deactivate" : "Activate"} ${school.name}? ${school.isActive ? "This changes its platform access status." : "This restores its active status."}`)) event.preventDefault(); }}>
              <input type="hidden" name="schoolId" value={school.id} />
              <input type="hidden" name="isActive" value={String(!school.isActive)} />
              <button type="submit" className={school.isActive ? "is-danger" : ""}>{school.isActive ? "Deactivate" : "Activate"}</button>
            </form>
          </div></td>
        </tr>)}{!filteredSchools.length && <tr><td colSpan={7} className="admin-portfolio__empty">No schools match these filters.</td></tr>}</tbody>
      </table></div>
      <footer className="admin-portfolio__table-footer"><span>Page {page} · {filteredSchools.length} displayed</span><div>{page > 1 && <Link href={pageHref(page - 1)}>← Previous</Link>}{page * pageSize < filteredCount && <Link href={pageHref(page + 1)}>Next →</Link>}</div></footer>
    </section>
  </div>;
}
