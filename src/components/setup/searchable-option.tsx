"use client";

import { useId } from "react";

type Option = { value: string; label: string };

export function SearchableOption({ label, name, defaultValue, options, required = true, placeholder }: { label: string; name: string; defaultValue?: string; options: Option[]; required?: boolean; placeholder?: string }) {
  const listId = useId();
  return <label className="setup-field">{label}<input name={name} list={listId} defaultValue={defaultValue} required={required} placeholder={placeholder} autoComplete="off" /><datalist id={listId}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</datalist></label>;
}

export function useIntlOptions() {
  const timeZones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  const currencies = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("currency") : [];
  const currencyNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "currency" }) : null;
  return {
    timeZones: ["UTC", ...timeZones.filter((zone) => zone !== "UTC")].map((value) => ({ value, label: value.replaceAll("_", " ") })),
    currencies: currencies.map((value) => ({ value, label: `${value} - ${currencyNames?.of(value) ?? value}` })),
    dateFormats: [
      { value: "YYYY-MM-DD", label: "2026-09-16" },
      { value: "DD/MM/YYYY", label: "16/09/2026" },
      { value: "MM/DD/YYYY", label: "09/16/2026" },
      { value: "DD MMM YYYY", label: "16 Sep 2026" },
    ],
  };
}
