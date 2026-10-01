import { describe, expect, it } from "vitest";

import { buildBrandingTheme, sanitizeColor } from "../../src/lib/school-branding";

describe("school branding theme normalization", () => {
  it("keeps valid hex colors and normalizes empty values", () => {
    expect(sanitizeColor("#1d4ed8")).toBe("#1d4ed8");
    expect(sanitizeColor("#1d4ed8 ")).toBe("#1d4ed8");
    expect(sanitizeColor("not-a-color")).toBeNull();
    expect(sanitizeColor(" ")).toBeNull();
  });

  it("uses a readable foreground color when a light primary is selected", () => {
    const theme = buildBrandingTheme({
      primaryColor: "#e0f2fe",
      secondaryColor: "#0f172a",
      accentColor: "#2563eb",
      backgroundColor: "#f8fafc",
      foregroundColor: "#0f172a",
      cardColor: "#ffffff",
      mutedColor: "#64748b",
      borderColor: "#dfe7ee",
      themeMode: "light",
    });

    expect(theme.primaryColor).toBe("#e0f2fe");
    expect(theme.foregroundColor).toBe("#0f172a");
    expect(theme.backgroundColor).toBe("#f8fafc");
    expect(theme.themeMode).toBe("light");
  });

  it("accepts dark mode and supports a dark theme override", () => {
    const theme = buildBrandingTheme({
      primaryColor: "#0f172a",
      secondaryColor: "#1e293b",
      accentColor: "#fbbf24",
      backgroundColor: "#020817",
      foregroundColor: "#e2e8f0",
      cardColor: "#0f172a",
      mutedColor: "#94a3b8",
      borderColor: "#334155",
      themeMode: "dark",
    });

    expect(theme.themeMode).toBe("dark");
    expect(theme.foregroundColor).toBe("#e2e8f0");
    expect(theme.backgroundColor).toBe("#020817");
  });
});
