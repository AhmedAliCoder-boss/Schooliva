"use client";

import { useMemo, useState } from "react";

import { LeaveDecisionForm } from "@/components/leave/leave-forms";

export type LeaveRegisterRow = {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  reason: string;
  approverNote: string | null;
  leaveType: string;
  personName: string;
  personId: string;
  personType: "student" | "teacher" | "staff";
  createdAt: string;
  attachmentUrl: string | null;
};

const statusOptions = ["requested", "approved", "rejected", "completed"] as const;
type Status = (typeof statusOptions)[number];

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function leaveDays(start: string, end: string) {
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  return Math.max(1, Math.round((to - from) / 86_400_000) + 1);
}

export function LeaveRegister({ rows, today }: { rows: LeaveRegisterRow[]; today: string }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status | "all">("all");
  const [personType, setPersonType] = useState<"all" | LeaveRegisterRow["personType"]>("all");
  const [date, setDate] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !query || [row.personName, row.personId, row.reason, row.leaveType, row.approverNote ?? ""].some((value) => value.toLocaleLowerCase().includes(query));
      const matchesDate = !date || row.startDate <= date && row.endDate >= date;
      return matchesSearch && matchesDate && (status === "all" || row.status === status) && (personType === "all" || row.personType === personType);
    });
  }, [date, personType, rows, search, status]);

  const counts = statusOptions.reduce((accumulator, item) => {
    accumulator[item] = rows.filter((row) => row.status === item).length;
    return accumulator;
  }, {} as Record<Status, number>);

  return <section className="leave-register">
    <div className="leave-register__heading">
      <div><p className="module-page-header__eyebrow">Live register</p><h2>Leave requests</h2><p>Search by person or reason, filter a date, and review decisions in one place.</p></div>
      <span className="leave-register__count">{filtered.length} of {rows.length} requests</span>
    </div>
    <div className="leave-status-filters" aria-label="Filter leave by status">
      <button type="button" className={status === "all" ? "active" : ""} onClick={() => setStatus("all")}><strong>{rows.length}</strong><span>All</span></button>
      {statusOptions.map((item) => <button type="button" key={item} className={`leave-status-filter leave-status-filter--${item} ${status === item ? "active" : ""}`} onClick={() => setStatus(status === item ? "all" : item)}><strong>{counts[item]}</strong><span>{item}</span></button>)}
    </div>
    <div className="leave-register__filters">
      <label>Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Person, ID, type, or reason" /></label>
      <label>Person<select value={personType} onChange={(event) => setPersonType(event.target.value as typeof personType)}><option value="all">All people</option><option value="student">Students</option><option value="teacher">Teachers</option><option value="staff">Staff</option></select></label>
      <label>Leave covering date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <button type="button" className="leave-register__reset" onClick={() => { setSearch(""); setStatus("all"); setPersonType("all"); setDate(""); }}>Clear filters</button>
    </div>
    <div className="leave-register__groups">
      {statusOptions.map((groupStatus) => {
        const groupRows = filtered.filter((row) => row.status === groupStatus);
        if (!groupRows.length) return null;
        return <details className={`leave-group leave-group--${groupStatus}`} key={groupStatus} open={groupStatus === "requested"}>
          <summary><span className={`leave-status-pill leave-status-pill--${groupStatus}`}>{groupStatus}</span><strong>{groupRows.length}</strong><span className="leave-group__summary-note">{groupStatus === "requested" ? "Awaiting review" : "Requests"}</span><span className="leave-group__chevron" aria-hidden="true">⌄</span></summary>
          <div className="leave-group__rows">
            {groupRows.map((row) => <article className="leave-request-card" key={row.id}>
              <div className="leave-request-card__main">
                <div className="leave-request-card__person"><span className={`leave-person-icon leave-person-icon--${row.personType}`}>{row.personType === "student" ? "ST" : row.personType === "teacher" ? "TE" : "SF"}</span><div><strong>{row.personName}</strong><small>{row.personType} {row.personId ? `· ${row.personId}` : ""}</small></div></div>
                <span className={`leave-status-pill leave-status-pill--${row.status}`}>{row.status}</span>
                <div className="leave-request-card__type"><span>Leave type</span><strong>{row.leaveType}</strong></div>
                <div className="leave-request-card__dates"><span>{formatDate(row.startDate)} – {formatDate(row.endDate)}</span><strong>{leaveDays(row.startDate, row.endDate)} {leaveDays(row.startDate, row.endDate) === 1 ? "day" : "days"}</strong></div>
                <div className="leave-request-card__reason"><span>Reason</span><p>{row.reason}</p></div>
                {row.attachmentUrl && <a className="leave-request-card__attachment" href={row.attachmentUrl} target="_blank" rel="noreferrer">Open supporting document ↗</a>}
                {row.approverNote && <div className="leave-request-card__note"><span>Decision note</span><p>{row.approverNote}</p></div>}
                {row.status === "approved" && row.personType !== "student" && row.startDate <= today && row.endDate >= today && <p className="leave-attendance-note">Approved leave today · saved as <strong>Excused</strong> in people attendance.</p>}
              </div>
              {row.status === "requested" && <LeaveDecisionForm id={row.id} />}
            </article>)}
          </div>
        </details>;
      })}
      {!filtered.length && <div className="leave-register__empty"><strong>No matching requests</strong><span>Try clearing a filter or changing your search.</span></div>}
    </div>
  </section>;
}
