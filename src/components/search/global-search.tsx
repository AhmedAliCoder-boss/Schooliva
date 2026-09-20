"use client";

import Link from "next/link";
import { useState } from "react";

import { globalSearchAction } from "@/app/actions/search";

type SearchResult = { id: string; type: string; title: string; subtitle: string; meta: Record<string, unknown> };

const resultLinks: Record<string, string> = {
  students: "/students",
  teachers: "/teachers",
  parents: "/parents",
  classes: "/setup",
  invoices: "/finance",
  books: "/library",
  assignments: "/assignments",
};

export function GlobalSearchBar({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Record<string, SearchResult[]>>({ students: [], teachers: [], parents: [], classes: [], invoices: [], books: [], assignments: [] });

  async function runSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults({ students: [], teachers: [], parents: [], classes: [], invoices: [], books: [], assignments: [] });
      return;
    }
    const next = await globalSearchAction(value);
    setResults(next ?? { students: [], teachers: [], parents: [], classes: [], invoices: [], books: [], assignments: [] });
  }

  const hasResults = Object.values(results).some((items) => items.length > 0);

  return <div className={`global-search ${compact ? "global-search--compact" : ""}`}>
    <span aria-hidden="true">&#9906;</span>
    <input value={query} onChange={(event) => runSearch(event.target.value)} placeholder={compact ? "Search anything..." : "Search students, teachers, parents, classes, invoices, books, assignments..."} aria-label="Search authorized Schooliva records" />
    {query.trim().length >= 2 && <div className="global-search-results" role="listbox">
      {hasResults ? Object.entries(results).map(([key, items]) => items.length ? <div key={key} className="global-search-group"><h3>{key}</h3>{items.map((item) => <Link href={resultLinks[key] ?? "/search"} key={`${key}-${item.id}`} className="global-search-item"><strong>{item.title}</strong><span>{item.subtitle}</span></Link>)}</div> : null) : <p className="global-search-empty">No authorized records found.</p>}
    </div>}
  </div>;
}
