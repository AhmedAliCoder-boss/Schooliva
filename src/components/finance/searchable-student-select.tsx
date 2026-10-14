"use client";

import { useId, useMemo, useRef, useState } from "react";

export type SearchableStudentOption = { id: string; name: string; searchText?: string };

export function SearchableOptionSelect({
  options,
  label,
  name,
  placeholder,
  onSelectionChange,
}: {
  options: SearchableStudentOption[];
  label: string;
  name: string;
  placeholder: string;
  onSelectionChange?: (optionId: string) => void;
}) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return options
      .filter((option) => !search || `${option.name} ${option.searchText ?? ""}`.toLocaleLowerCase().includes(search))
      .slice(0, 50);
  }, [options, query]);

  function chooseOption(option: SearchableStudentOption) {
    setSelectedStudentId(option.id);
    setQuery(option.name);
    setIsOpen(false);
    inputRef.current?.setCustomValidity("");
    onSelectionChange?.(option.id);
  }

  return <div className="invoice-student-picker">
    <label className="student-field">
      {label}
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={isOpen && matches[activeIndex] ? `${listboxId}-option-${matches[activeIndex].id}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        required
        onFocus={() => {
          setIsOpen(true);
          setActiveIndex(0);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedStudentId("");
          setActiveIndex(0);
          setIsOpen(true);
          event.currentTarget.setCustomValidity(event.target.value.trim() ? "Choose a student from the search results." : "");
          onSelectionChange?.("");
        }}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsOpen(false);
          if (event.key === "ArrowDown" && matches.length) {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((current) => Math.min(current + 1, matches.length - 1));
          }
          if (event.key === "ArrowUp" && matches.length) {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          }
          if (event.key === "Enter" && isOpen && matches.length) {
            event.preventDefault();
            chooseOption(matches[activeIndex] ?? matches[0]);
          }
        }}
      />
    </label>
    <input type="hidden" name={name} value={selectedStudentId} />
    {isOpen && <div className="invoice-student-picker__options" id={listboxId} role="listbox" aria-label={label}>
      {matches.length ? matches.map((option, index) => <button
        type="button"
        role="option"
        id={`${listboxId}-option-${option.id}`}
        aria-selected={option.id === selectedStudentId}
        className={index === activeIndex ? "active" : ""}
        key={option.id}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => chooseOption(option)}
      ><span>{option.name}</span></button>) : <p>No {label.toLocaleLowerCase()} match this search.</p>}
    </div>}
  </div>;
}

export function SearchableStudentSelect({
  students,
  placeholder = "Search student name, ID, or admission number",
}: {
  students: SearchableStudentOption[];
  placeholder?: string;
}) {
  return <SearchableOptionSelect
    options={students}
    label="Student"
    name="studentId"
    placeholder={placeholder}
  />;
}
