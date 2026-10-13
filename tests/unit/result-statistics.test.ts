import { describe, expect, it } from "vitest";

import {
  calculatePublishedResultStatistics,
  getPublishedResultStudentOutcomes,
  type PublishedResultMark,
} from "../../src/lib/results/statistics";

describe("calculatePublishedResultStatistics", () => {
  it("counts a student as passed only when every subject meets its configured or default threshold", () => {
    const rows: PublishedResultMark[] = [
      { exam_id: "exam-a", student_id: "student-a", class_id: "class-a", section_id: "section-a", obtained_marks: 80, maximum_marks: 100, passing_marks: null },
      { exam_id: "exam-a", student_id: "student-a", class_id: "class-a", section_id: "section-a", obtained_marks: 35, maximum_marks: 100, passing_marks: 30 },
      { exam_id: "exam-a", student_id: "student-b", class_id: "class-a", section_id: "section-a", obtained_marks: 90, maximum_marks: 100, passing_marks: null },
      { exam_id: "exam-a", student_id: "student-b", class_id: "class-a", section_id: "section-a", obtained_marks: 39, maximum_marks: 100, passing_marks: null },
    ];

    expect(calculatePublishedResultStatistics(rows)).toMatchObject({
      students: 2,
      passed: 1,
      failed: 1,
    });
  });

  it("counts tied top-three positions per exam, class, and section", () => {
    const rows: PublishedResultMark[] = [
      { exam_id: "exam-a", student_id: "student-a", class_id: "class-a", section_id: "section-a", obtained_marks: 100, maximum_marks: 100, passing_marks: null },
      { exam_id: "exam-a", student_id: "student-b", class_id: "class-a", section_id: "section-a", obtained_marks: 90, maximum_marks: 100, passing_marks: null },
      { exam_id: "exam-a", student_id: "student-c", class_id: "class-a", section_id: "section-a", obtained_marks: 90, maximum_marks: 100, passing_marks: null },
      { exam_id: "exam-a", student_id: "student-d", class_id: "class-a", section_id: "section-a", obtained_marks: 85, maximum_marks: 100, passing_marks: null },
      { exam_id: "exam-a", student_id: "student-e", class_id: "class-a", section_id: "section-a", obtained_marks: 80, maximum_marks: 100, passing_marks: null },
      { exam_id: "exam-b", student_id: "student-f", class_id: "class-b", section_id: "section-b", obtained_marks: 75, maximum_marks: 100, passing_marks: null },
    ];

    expect(calculatePublishedResultStatistics(rows).positionHolders).toBe(4);
  });

  it("returns individual school-wide outcomes with section-scoped positions", () => {
    const rows: PublishedResultMark[] = [
      { exam_id: "exam-a", student_id: "a", class_id: "class-a", section_id: "section-a", obtained_marks: 100, maximum_marks: 100, passing_marks: null },
      { exam_id: "exam-a", student_id: "b", class_id: "class-a", section_id: "section-a", obtained_marks: 90, maximum_marks: 100, passing_marks: null },
      { exam_id: "exam-a", student_id: "c", class_id: "class-a", section_id: "section-a", obtained_marks: 80, maximum_marks: 100, passing_marks: null },
      { exam_id: "exam-a", student_id: "d", class_id: "class-a", section_id: "section-a", obtained_marks: 30, maximum_marks: 100, passing_marks: null },
    ];

    expect(getPublishedResultStudentOutcomes(rows)).toEqual([
      { examId: "exam-a", studentId: "a", passed: true, position: 1 },
      { examId: "exam-a", studentId: "b", passed: true, position: 2 },
      { examId: "exam-a", studentId: "c", passed: true, position: 3 },
      { examId: "exam-a", studentId: "d", passed: false, position: 4 },
    ]);
  });
});
