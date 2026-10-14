"use client";

import { useMemo, useState } from "react";

import { CopyStatusForm, MemberStatusForm, ReturnBookForm } from "@/components/library/library-forms";

export type LibraryBookRow = {
  id: string;
  title: string;
  isbn: string;
  author: string;
  category: string;
  publisher: string;
  rackLocation: string;
  totalCopies: number;
  availableCopies: number;
  onLoanCopies: number;
};

export type LibraryLoanRow = {
  id: string;
  title: string;
  copyNumber: string;
  memberName: string;
  memberNumber: string;
  memberStatus: string;
  issuedOn: string;
  dueDate: string;
  returnedOn: string | null;
  status: string;
  fineAmount: number;
};

export type LibraryCopyRow = {
  id: string;
  title: string;
  copyNumber: string;
  status: string;
  conditionNote: string;
};

export type LibraryMemberRow = {
  id: string;
  name: string;
  memberType: string;
  membershipNumber: string;
  status: string;
  activeLoans: number;
};

type Tab = "catalog" | "inventory" | "circulation" | "members";
type Filter = "all" | "available" | "issued" | "overdue" | "returned" | "active" | "inactive" | "blocked" | "reserved" | "lost" | "damaged";

function statusForLoan(loan: LibraryLoanRow, today: string) {
  if (loan.returnedOn || loan.status === "returned") return "returned";
  if (loan.status === "lost") return "lost";
  if (loan.status === "cancelled") return "cancelled";
  return loan.dueDate < today ? "overdue" : "issued";
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`library-status library-status--${status}`}>{status.replaceAll("_", " ")}</span>;
}

export function LibraryRegister({
  books,
  copies,
  loans,
  members,
  canReturn,
  canManage,
  today,
}: {
  books: LibraryBookRow[];
  copies: LibraryCopyRow[];
  loans: LibraryLoanRow[];
  members: LibraryMemberRow[];
  canReturn: boolean;
  canManage: boolean;
  today: string;
}) {
  const [tab, setTab] = useState<Tab>("catalog");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const openLoans = loans.filter((loan) => ["issued", "overdue"].includes(statusForLoan(loan, today)));
  const overdueLoans = loans.filter((loan) => statusForLoan(loan, today) === "overdue");
  const visibleBooks = useMemo(() => books.filter((book) => {
    const matchesQuery = `${book.title} ${book.isbn} ${book.author} ${book.category} ${book.publisher} ${book.rackLocation}`.toLocaleLowerCase().includes(normalizedQuery);
    const matchesStatus = filter === "all"
      || (filter === "available" && book.availableCopies > 0)
      || (filter === "issued" && book.onLoanCopies > 0);
    return matchesQuery && matchesStatus;
  }), [books, filter, normalizedQuery]);
  const visibleLoans = useMemo(() => loans.filter((loan) => {
    const status = statusForLoan(loan, today);
    const matchesQuery = `${loan.title} ${loan.copyNumber} ${loan.memberName} ${loan.memberNumber}`.toLocaleLowerCase().includes(normalizedQuery);
    return matchesQuery && (filter === "all" || status === filter);
  }), [loans, filter, normalizedQuery, today]);
  const visibleCopies = useMemo(() => copies.filter((copy) =>
    `${copy.title} ${copy.copyNumber} ${copy.status} ${copy.conditionNote}`.toLocaleLowerCase().includes(normalizedQuery)
    && (filter === "all" || copy.status === filter),
  ), [copies, filter, normalizedQuery]);
  const visibleMembers = useMemo(() => members.filter((member) =>
    `${member.name} ${member.membershipNumber} ${member.memberType} ${member.status}`.toLocaleLowerCase().includes(normalizedQuery)
    && (filter === "all" || member.status === filter),
  ), [members, filter, normalizedQuery]);
  const filters: Filter[] = tab === "catalog"
    ? ["all", "available", "issued"]
    : tab === "inventory"
      ? ["all", "available", "issued", "reserved", "lost", "damaged"]
      : tab === "circulation"
        ? ["all", "issued", "overdue", "returned"]
        : ["all", "active", "blocked", "inactive"];

  function changeTab(nextTab: Tab) {
    setTab(nextTab);
    setFilter("all");
    setQuery("");
  }

  return <section className="library-register" aria-label="Library records">
    <div className="library-register__top">
      <div><p className="module-page-header__eyebrow">Library workspace</p><h2>Find a book, loan, or member</h2><p>Search the catalog and keep circulation activity in one place.</p></div>
      <div className="library-register__counts"><span>{books.length} titles</span><span>{openLoans.length} active loans</span><span className={overdueLoans.length ? "is-overdue" : ""}>{overdueLoans.length} overdue</span></div>
    </div>
    <div className="library-register__toolbar">
      <div className="library-register__tabs" role="tablist" aria-label="Library records">
        {(["catalog", "inventory", "circulation", "members"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} onClick={() => changeTab(item)}>{item === "catalog" ? "Catalog" : item === "inventory" ? "Copies" : item === "circulation" ? "Circulation" : "Members"}</button>)}
      </div>
      <label className="library-register__search"><span className="sr-only">Search {tab}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "catalog" ? "Search title, ISBN, author, category…" : tab === "inventory" ? "Search title or copy number…" : tab === "circulation" ? "Search book, copy, member…" : "Search member name or number…"} /></label>
    </div>
    <div className="library-register__filters" role="group" aria-label={`${tab} filters`}>
      {filters.map((item) => <button key={item} type="button" className={filter === item ? "active" : ""} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === "all" ? "All" : item}</button>)}
    </div>

    {tab === "catalog" && <div className="library-book-grid">
      {visibleBooks.length ? visibleBooks.map((book) => <article className="library-book-card" key={book.id}>
        <div className="library-book-card__icon" aria-hidden="true">B</div>
        <div className="library-book-card__content">
          <div className="library-book-card__title"><div><h3>{book.title}</h3><span>{book.author}</span></div><StatusBadge status={book.availableCopies ? "available" : book.onLoanCopies ? "issued" : "unavailable"} /></div>
          <p>{book.category} <span>·</span> {book.publisher}</p>
          <div className="library-book-card__meta"><span>ISBN <strong>{book.isbn}</strong></span>{book.rackLocation && <span>Shelf <strong>{book.rackLocation}</strong></span>}</div>
          <div className="library-book-card__stock"><span>{book.availableCopies} of {book.totalCopies} available</span><span className="library-stock-track"><i style={{ width: `${book.totalCopies ? Math.round(book.availableCopies / book.totalCopies * 100) : 0}%` }} /></span></div>
        </div>
      </article>) : <div className="library-register__empty"><h3>No matching titles</h3><p>Try a different search or availability filter.</p></div>}
    </div>}

    {tab === "inventory" && <div className="library-copy-list">
      {visibleCopies.length ? visibleCopies.map((copy) => <article className="library-copy-card" key={copy.id}>
        <div><strong>{copy.title}</strong><span>Copy {copy.copyNumber}</span>{copy.conditionNote && <small>{copy.conditionNote}</small>}</div>
        <StatusBadge status={copy.status} />
        {canManage && copy.status !== "issued"
          ? <CopyStatusForm copyId={copy.id} status={copy.status} conditionNote={copy.conditionNote} />
          : <span className="library-copy-card__notice">{copy.status === "issued" ? "Return through Circulation" : "Inventory status is read-only"}</span>}
      </article>) : <div className="library-register__empty"><h3>No matching copies</h3><p>Add copies to the catalog or adjust your filters.</p></div>}
    </div>}

    {tab === "circulation" && <div className="library-loan-list">
      {visibleLoans.length ? visibleLoans.map((loan) => {
        const status = statusForLoan(loan, today);
        const daysOverdue = status === "overdue" ? Math.max(1, Math.floor((new Date(`${today}T00:00:00Z`).getTime() - new Date(`${loan.dueDate}T00:00:00Z`).getTime()) / 86400000)) : 0;
        return <article className={`library-loan-card library-loan-card--${status}`} key={loan.id}>
          <div className="library-loan-card__main">
            <div className="library-book-card__icon" aria-hidden="true">B</div>
            <div><h3>{loan.title}</h3><p>Copy {loan.copyNumber} <span>·</span> {loan.memberName} <span>·</span> ID {loan.memberNumber}</p></div>
            <StatusBadge status={status} />
          </div>
          <div className="library-loan-card__dates"><span>Issued <strong>{loan.issuedOn}</strong></span><span>{status === "returned" ? "Returned" : "Due"} <strong>{loan.returnedOn ?? loan.dueDate}</strong></span>{daysOverdue > 0 && <span className="is-overdue">{daysOverdue} day{daysOverdue === 1 ? "" : "s"} overdue</span>}</div>
          <div className="library-loan-card__action">{canReturn && ["issued", "overdue"].includes(status) ? <ReturnBookForm transactionId={loan.id} suggestedFine={loan.fineAmount} /> : <span>Fine {Number(loan.fineAmount).toFixed(2)}</span>}</div>
        </article>;
      }) : <div className="library-register__empty"><h3>No circulation records found</h3><p>Issue a book to create a loan record, or adjust your search.</p></div>}
    </div>}

    {tab === "members" && <div className="library-member-grid">
      {visibleMembers.length ? visibleMembers.map((member) => <article className="library-member-card" key={member.id}>
        <span className={`library-member-card__avatar library-member-card__avatar--${member.memberType}`}>{member.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
        <div className="library-member-card__identity"><h3>{member.name}</h3><p>{member.memberType} <span>·</span> {member.membershipNumber}</p></div>
        <StatusBadge status={member.status} />
        <div className="library-member-card__loans"><strong>{member.activeLoans}</strong><span>active loans</span></div>
        {canManage && <MemberStatusForm memberId={member.id} status={member.status} />}
      </article>) : <div className="library-register__empty"><h3>No members found</h3><p>Register a student or teacher to enable book borrowing.</p></div>}
    </div>}
  </section>;
}
