"use client";

import { useState } from "react";

import { globalSearchAction } from "@/app/actions/search";

type SearchResult = { id: string; type: string; title: string; subtitle: string; meta: Record<string, unknown> };

export function GlobalSearchBar() {
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

  return <div className="global-search"><input value={query} onChange={(event) => runSearch(event.target.value)} placeholder="Search students, teachers, parents, classes, invoices, books, assignments..." /><div className="global-search-results">{Object.entries(results).map(([key, items]) => items.length ? <div key={key} className="global-search-group"><h3>{key}</h3>{items.map((item) => <div key={`${key}-${item.id}`} className="global-search-item"><strong>{item.title}</strong><span>{item.subtitle}</span></div>)}</div> : null)}</div></div>;
}
