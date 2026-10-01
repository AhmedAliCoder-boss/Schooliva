import { describe, expect, it } from "vitest";

import { buildSchoolReportCsv } from "../../src/lib/reports/export";

describe("school report export", () => {
  it("serializes a school report summary to CSV without losing the school context", () => {
    const csv = buildSchoolReportCsv({
      school_name: "North Hills Academy",
      student_summary: { total_students: 120 },
      attendance_summary: { present_rate: 91.2 },
      fee_summary: { total_collected: 45000 },
    });

    expect(csv).toContain("school_name,North Hills Academy");
    expect(csv).toContain("report_section,metric,value");
    expect(csv).toContain("student_summary,total_students,120");
    expect(csv).toContain("attendance_summary,present_rate,91.2");
    expect(csv).toContain("fee_summary,total_collected,45000");
  });
});
