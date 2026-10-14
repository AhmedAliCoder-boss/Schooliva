import { describe, expect, it } from "vitest";

import { parseReportFilters } from "../../src/lib/reports/filters";

describe("school report filters", () => {
  it("preserves a valid date range and canonical UUID filters", () => {
    const params = new URLSearchParams({
      from: "2026-09-01",
      to: "2026-09-30",
      classId: "11111111-1111-1111-1111-111111111111",
      sectionId: "22222222-2222-2222-2222-222222222222",
      sessionId: "33333333-3333-3333-3333-333333333333",
    });

    expect(parseReportFilters(params, "2026-10-15")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
      classId: "11111111-1111-1111-1111-111111111111",
      sectionId: "22222222-2222-2222-2222-222222222222",
      sessionId: "33333333-3333-3333-3333-333333333333",
    });
  });

  it("uses a safe 30-day default for invalid or excessive date ranges", () => {
    const invalidDate = parseReportFilters(new URLSearchParams({
      from: "2026-02-30",
      to: "2026-03-01",
      classId: "not-a-uuid",
    }), "2026-10-15");
    const tooWide = parseReportFilters(new URLSearchParams({
      from: "2024-01-01",
      to: "2026-10-15",
    }), "2026-10-15");

    expect(invalidDate).toEqual({
      from: "2026-09-15",
      to: "2026-10-15",
      classId: "",
      sectionId: "",
      sessionId: "",
    });
    expect(tooWide.from).toBe("2026-09-15");
    expect(tooWide.to).toBe("2026-10-15");
  });
});
