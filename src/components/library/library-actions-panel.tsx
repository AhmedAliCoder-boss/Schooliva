"use client";

import { useState } from "react";

import { AddCopiesForm, AuthorForm, BookForm, CategoryForm, IssueBookForm, MemberForm, PublisherForm } from "@/components/library/library-forms";

type Option = { id: string; name: string };
type CopyOption = Option & { available: boolean };
type ActionTab = "book" | "copies" | "member" | "labels" | "issue";

type Tab = {
  id: ActionTab;
  label: string;
  description: string;
  available: boolean;
};

export function LibraryActionsPanel({
  authors,
  categories,
  publishers,
  books,
  students,
  teachers,
  copies,
  members,
  today,
  canManage,
  canIssue,
}: {
  authors: Option[];
  categories: Option[];
  publishers: Option[];
  books: Option[];
  students: Option[];
  teachers: Option[];
  copies: CopyOption[];
  members: Option[];
  today: string;
  canManage: boolean;
  canIssue: boolean;
}) {
  const allTabs: Tab[] = [
    { id: "book", label: "Add a book", description: "Create a catalog record with ISBN and classification.", available: canManage },
    { id: "copies", label: "Add physical copies", description: "Register copies with unique labels and shelf tracking.", available: canManage },
    { id: "member", label: "Register a member", description: "Link a student or teacher to their Schooliva profile.", available: canManage },
    { id: "labels", label: "Manage catalog labels", description: "Add authors, categories, and publishers.", available: canManage },
    { id: "issue", label: "Issue a book", description: "Lend an available copy to an active library member.", available: canIssue },
  ];
  const tabs = allTabs.filter((tab) => tab.available);
  const [activeTab, setActiveTab] = useState<ActionTab>(tabs[0]?.id ?? "book");

  function renderActiveForm() {
    switch (activeTab) {
      case "book":
        return <BookForm authors={authors} categories={categories} publishers={publishers} />;
      case "copies":
        return <AddCopiesForm books={books} />;
      case "member":
        return <MemberForm students={students} teachers={teachers} />;
      case "labels":
        return <div className="library-metadata-forms"><AuthorForm /><CategoryForm /><PublisherForm /></div>;
      case "issue":
        return <IssueBookForm copies={copies} members={members} today={today} />;
    }
  }

  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  if (!tabs.length) {
    return <section className="library-actions library-actions--readonly" id="library-actions"><p className="library-view-note">You have read-only access to this library.</p></section>;
  }

  return <section className="library-actions library-actions--tabs" id="library-actions" aria-label="Library actions">
    <div className="library-action-tabs" role="tablist" aria-label="Choose a library action">
      {tabs.map((tab) => <button
        key={tab.id}
        id={`library-action-tab-${tab.id}`}
        type="button"
        role="tab"
        aria-selected={activeTab === tab.id}
        aria-controls="library-action-panel"
        className={activeTab === tab.id ? "active" : ""}
        onClick={() => setActiveTab(tab.id)}
      >{tab.label}</button>)}
    </div>
    {active && <div
      className="library-action-tab-panel"
      id="library-action-panel"
      role="tabpanel"
      aria-labelledby={`library-action-tab-${active.id}`}
      key={active.id}
    >
      <div className="library-action-tab-panel__heading"><div><h2>{active.label}</h2><p>{active.description}</p></div><span>{tabs.findIndex((tab) => tab.id === active.id) + 1} / {tabs.length}</span></div>
      {renderActiveForm()}
    </div>}
  </section>;
}
