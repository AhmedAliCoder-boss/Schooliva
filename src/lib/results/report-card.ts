export type ReportMark = {
  obtained_marks: number | string;
  maximum_marks: number | string;
  passing_marks: number | string | null;
  percentage: number | string;
};

export type GradeBoundary = {
  grade: string;
  min_percentage: number | string;
  max_percentage: number | string;
};

export function getEffectivePassingMarks(maximumMarks: number | string, passingMarks: number | string | null) {
  return passingMarks === null
    ? Number(maximumMarks) * 0.4
    : Number(passingMarks);
}

export function calculateReportCardSummary(rows: ReportMark[], boundaries: GradeBoundary[]) {
  const totalObtained = rows.reduce((sum, row) => sum + Number(row.obtained_marks), 0);
  const totalMaximum = rows.reduce((sum, row) => sum + Number(row.maximum_marks), 0);
  const percentage = totalMaximum > 0 ? (totalObtained / totalMaximum) * 100 : 0;
  const grade = boundaries.find((boundary) =>
    percentage >= Number(boundary.min_percentage) && percentage <= Number(boundary.max_percentage),
  )?.grade ?? null;
  const passed = rows.every((row) =>
    Number(row.obtained_marks) >= getEffectivePassingMarks(row.maximum_marks, row.passing_marks),
  );

  return { totalObtained, totalMaximum, percentage, grade, passed };
}

export function getStudentPosition(
  results: Array<{ student_id: string; percentage: number | string }>,
  studentId: string,
) {
  return getStudentPositions(results).get(studentId) ?? null;
}

export function getStudentPositions(results: Array<{ student_id: string; percentage: number | string }>) {
  const ordered = [...results].sort((left, right) =>
    Number(right.percentage) - Number(left.percentage) || left.student_id.localeCompare(right.student_id),
  );
  const positions = new Map<string, number>();
  let previousPercentage: number | null = null;
  let currentPosition = 0;
  ordered.forEach((result, index) => {
    const percentage = Number(result.percentage);
    if (previousPercentage === null || percentage !== previousPercentage) currentPosition = index + 1;
    positions.set(result.student_id, currentPosition);
    previousPercentage = percentage;
  });
  return positions;
}

export function getStudentResultStatus(passed: boolean) {
  return passed ? "passed" as const : "failed" as const;
}

export function formatStudentPosition(position: number | null) {
  if (position === null) return "—";
  const suffix = position % 100 >= 11 && position % 100 <= 13
    ? "th"
    : position % 10 === 1
      ? "st"
      : position % 10 === 2
        ? "nd"
        : position % 10 === 3
          ? "rd"
          : "th";
  return `${position}${suffix}`;
}
