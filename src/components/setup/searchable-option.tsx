"use client";

import { useId } from "react";

type Option = { value: string; label: string };

export function SearchableOption({ label, name, defaultValue, options, required = true, placeholder, error }: { label: string; name: string; defaultValue?: string; options: Option[]; required?: boolean; placeholder?: string; error?: string }) {
  const listId = useId();
  return <label className={`setup-field ${error ? "has-error" : ""}`}>{label}<input name={name} list={listId} defaultValue={defaultValue} required={required} placeholder={placeholder} autoComplete="off" aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} />{error && <span id={`${name}-error`} className="setup-field-error">{error}</span>}<datalist id={listId}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</datalist></label>;
}

export function useIntlOptions() {
  const timeZones = [
    "UTC", "Asia/Karachi", "Asia/Dubai", "Asia/Kolkata", "Asia/Dhaka", "Asia/Riyadh",
    "Asia/Singapore", "Asia/Tokyo", "Europe/London", "Europe/Paris", "Europe/Berlin",
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "Australia/Sydney",
  ];
  const currencies = ["PKR", "USD", "EUR", "GBP", "AED", "SAR", "INR", "BDT", "AUD", "CAD", "CNY", "JPY", "SGD", "ZAR"];
  return {
    timeZones: timeZones.map((value) => ({ value, label: value.replaceAll("_", " ") })),
    currencies: currencies.map((value) => ({ value, label: value })),
    dateFormats: [
      { value: "YYYY-MM-DD", label: "2026-09-16" },
      { value: "DD/MM/YYYY", label: "16/09/2026" },
      { value: "MM/DD/YYYY", label: "09/16/2026" },
      { value: "DD MMM YYYY", label: "16 Sep 2026" },
    ],
  };
}
