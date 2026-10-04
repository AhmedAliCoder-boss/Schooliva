"use client";

import { useEffect, useState } from "react";

import { saveSchoolBranding } from "@/app/actions/admin";
import type { BrandingTheme } from "@/lib/school-branding";

const colorFields: Array<{ name: keyof Omit<BrandingTheme, "themeMode">; label: string }> = [
  { name: "primaryColor", label: "Primary color" },
  { name: "secondaryColor", label: "Secondary color" },
  { name: "accentColor", label: "Accent color" },
  { name: "backgroundColor", label: "Background color" },
  { name: "foregroundColor", label: "Foreground color" },
  { name: "cardColor", label: "Card color" },
  { name: "mutedColor", label: "Muted color" },
  { name: "borderColor", label: "Border color" },
  { name: "successColor", label: "Success color" },
  { name: "warningColor", label: "Warning color" },
  { name: "destructiveColor", label: "Destructive color" },
  { name: "infoColor", label: "Info color" },
];

export function SchoolBrandingEditor({
  schoolId,
  schoolName,
  initialTheme,
  logoUrl,
}: {
  schoolId: string;
  schoolName: string;
  initialTheme: BrandingTheme;
  logoUrl: string | null;
}) {
  const [theme, setTheme] = useState(initialTheme);
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);

  useEffect(() => {
    if (!previewLogo) return;
    return () => URL.revokeObjectURL(previewLogo);
  }, [previewLogo]);

  const previewStyle = {
    backgroundColor: theme.backgroundColor,
    borderColor: theme.borderColor,
    color: theme.foregroundColor,
  };

  return (
    <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", marginTop: 16 }}>
      <form action={saveSchoolBranding} className="student-form school-branding-form">
        <input type="hidden" name="schoolId" value={schoolId} />
        <div className="student-form-grid school-branding-fields">
          <label className="student-field">
            School logo
            <input
              type="file"
              name="schoolLogo"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                setPreviewLogo(file ? URL.createObjectURL(file) : null);
              }}
            />
          </label>
          {colorFields.map(({ name, label }) => (
            <label className="student-field" key={name}>
              {label}
              <input
                type="color"
                name={name}
                value={theme[name]}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setTheme((current) => ({ ...current, [name]: value }));
                }}
              />
              <span>{theme[name]}</span>
            </label>
          ))}
          <label className="student-field">
            Theme
            <select
              name="themeMode"
              value={theme.themeMode}
              onChange={(event) => {
                const themeMode = event.currentTarget.value as BrandingTheme["themeMode"];
                setTheme((current) => ({ ...current, themeMode }));
              }}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>
        </div>
        <button type="submit" className="dashboard-action dashboard-action--primary">Save branding</button>
      </form>

      <section aria-label="Live school branding preview" style={{ ...previewStyle, alignSelf: "start", border: `1px solid ${theme.borderColor}`, borderRadius: 14, minWidth: 0, overflow: "hidden" }}>
        <header style={{ alignItems: "center", backgroundColor: theme.secondaryColor, color: "#fff", display: "flex", gap: 12, minHeight: 72, padding: 16 }}>
          <div style={{ alignItems: "center", backgroundColor: theme.cardColor, borderRadius: 9, display: "grid", height: 42, justifyItems: "center", overflow: "hidden", width: 58 }}>
            {(previewLogo || logoUrl)
              ? <img alt={`${schoolName} logo preview`} src={previewLogo ?? logoUrl ?? undefined} style={{ height: "100%", objectFit: "contain", width: "100%" }} />
              : <span style={{ color: theme.primaryColor, fontSize: 11, fontWeight: 800 }}>LOGO</span>}
          </div>
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: 14 }}>{schoolName}</strong>
            <span style={{ color: theme.mutedColor, fontSize: 11 }}>School workspace preview</span>
          </div>
          <span style={{ backgroundColor: theme.accentColor, borderRadius: 999, color: theme.foregroundColor, fontSize: 10, marginLeft: "auto", padding: "6px 9px" }}>{theme.themeMode}</span>
        </header>
        <div style={{ display: "grid", gap: 14, padding: 16 }}>
          <div>
            <span style={{ color: theme.mutedColor, fontSize: 11 }}>WELCOME BACK</span>
            <h3 style={{ color: theme.foregroundColor, fontSize: 19, margin: "5px 0 12px" }}>School dashboard</h3>
            <button type="button" style={{ backgroundColor: theme.primaryColor, border: 0, borderRadius: 7, color: "#fff", font: "inherit", fontSize: 12, padding: "9px 13px" }}>Primary action</button>
          </div>
          <article style={{ backgroundColor: theme.cardColor, border: `1px solid ${theme.borderColor}`, borderRadius: 10, padding: 14 }}>
            <span style={{ color: theme.mutedColor, fontSize: 11 }}>STUDENTS</span>
            <strong style={{ color: theme.secondaryColor, display: "block", fontSize: 24, marginTop: 4 }}>1,248</strong>
            <span style={{ color: theme.successColor, fontSize: 11 }}>↑ 8% this term</span>
          </article>
          <div aria-label="Status color preview" style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {[
              ["Success", theme.successColor],
              ["Warning", theme.warningColor],
              ["Alert", theme.destructiveColor],
              ["Info", theme.infoColor],
            ].map(([label, color]) => (
              <span key={label} style={{ backgroundColor: color, borderRadius: 999, color: "#fff", fontSize: 10, padding: "5px 9px" }}>{label}</span>
            ))}
          </div>
          <div aria-label="All selected branding colors" style={{ display: "grid", gap: 7, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            {colorFields.map(({ name, label }) => (
              <div key={name} title={`${label}: ${theme[name]}`} style={{ minWidth: 0, textAlign: "center" }}>
                <div style={{ backgroundColor: theme[name], border: `1px solid ${theme.borderColor}`, borderRadius: 6, height: 26 }} />
                <span style={{ color: theme.mutedColor, display: "block", fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
