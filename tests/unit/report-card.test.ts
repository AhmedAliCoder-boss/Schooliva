import { describe, expect, it } from "vitest";

import { calculateReportCardSummary, formatStudentPosition, getEffectivePassingMarks, getStudentPosition, getStudentPositions, getStudentResultStatus } from "../../src/lib/results/report-card";

describe("calculateReportCardSummary", () => {
  it("calculates weighted overall percentage and matching grade", () => {
    const summary = calculateReportCardSummary([
      { obtained_marks: 45, maximum_marks: 50, passing_marks: 20, percentage: 90 },
      { obtained_marks: 30, maximum_marks: 100, passing_marks: 40, percentage: 30 },
    ], [
      { grade: "A", min_percentage: 70, max_percentage: 100 },
      { grade: "B", min_percentage: 40, max_percentage: 69.99 },
    ]);

    expect(summary).toEqual({
      totalObtained: 75,
      totalMaximum: 150,
      percentage: 50,
      grade: "B",
      passed: false,
    });
  });

  it("uses 40% of each subject maximum when passing marks are blank", () => {
    const summary = calculateReportCardSummary([
      { obtained_marks: 40, maximum_marks: 100, passing_marks: null, percentage: 40 },
      { obtained_marks: 7.99, maximum_marks: 20, passing_marks: null, percentage: 39.95 },
    ], []);

    expect(summary.passed).toBe(false);
  });

  it("shows default passing marks in exam setup and preserves configured values", () => {
    expect(getEffectivePassingMarks(100, null)).toBe(40);
    expect(getEffectivePassingMarks(50, null)).toBe(20);
    expect(getEffectivePassingMarks(100, 35)).toBe(35);
  });

  it("passes when blank pass marks meet the 40% subject threshold", () => {
    expect(calculateReportCardSummary([
      { obtained_marks: 40, maximum_marks: 100, passing_marks: null, percentage: 40 },
      { obtained_marks: 8, maximum_marks: 20, passing_marks: null, percentage: 40 },
    ], []).passed).toBe(true);
  });

  it("uses configured passing marks instead of the 40% default", () => {
    expect(calculateReportCardSummary([
      { obtained_marks: 35, maximum_marks: 100, passing_marks: 30, percentage: 35 },
    ], []).passed).toBe(true);
  });
});

describe("getStudentPosition", () => {
  const results = [
    { student_id: "student-a", percentage: 89.5 },
    { student_id: "student-b", percentage: 76 },
    { student_id: "student-c", percentage: 76 },
    { student_id: "student-d", percentage: 53 },
  ];

  it("assigns competition rank and shares rank for equal results", () => {
    expect(getStudentPosition(results, "student-a")).toBe(1);
    expect(getStudentPosition(results, "student-b")).toBe(2);
    expect(getStudentPosition(results, "student-c")).toBe(2);
    expect(getStudentPosition(results, "missing")).toBeNull();
  });

  it("calculates all competition positions with one ranking", () => {
    expect([...getStudentPositions(results).entries()]).toEqual([
      ["student-a", 1],
      ["student-b", 2],
      ["student-c", 2],
      ["student-d", 4],
    ]);
  });
});

describe("getStudentResultStatus", () => {
  it("reports only pass or fail status regardless of position", () => {
    expect(getStudentResultStatus(true)).toBe("passed");
    expect(getStudentResultStatus(false)).toBe("failed");
  });
});

describe("formatStudentPosition", () => {
  it("formats rank positions with the correct ordinal suffix", () => {
    expect(formatStudentPosition(1)).toBe("1st");
    expect(formatStudentPosition(2)).toBe("2nd");
    expect(formatStudentPosition(3)).toBe("3rd");
    expect(formatStudentPosition(4)).toBe("4th");
    expect(formatStudentPosition(11)).toBe("11th");
    expect(formatStudentPosition(22)).toBe("22nd");
    expect(formatStudentPosition(null)).toBe("—");
  });
});
