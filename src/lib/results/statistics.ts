import { getEffectivePassingMarks } from "./report-card";

export type PublishedResultMark = {
  exam_id: string;
  student_id: string;
  class_id: string;
  section_id: string | null;
  obtained_marks: number | string;
  maximum_marks: number | string;
  passing_marks: number | string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  student_identifier?: string | null;
  class_name?: string | null;
  section_name?: string | null;
};

export type PublishedResultFilter = "passed" | "failed" | "top3";
export type PublishedStudentOutcome = {
  examId: string;
  studentId: string;
  passed: boolean;
  position: number;
};

type StudentExamResult = {
  examId: string;
  studentId: string;
  classId: string;
  sectionId: string | null;
  totalObtained: number;
  totalMaximum: number;
  passed: boolean;
};

function aggregateStudentExamResults(rows: PublishedResultMark[]) {
  const students = new Map<string, StudentExamResult>();

  for (const row of rows) {
    const key = `${row.exam_id}:${row.student_id}`;
    const result = students.get(key) ?? {
      examId: row.exam_id,
      studentId: row.student_id,
      classId: row.class_id,
      sectionId: row.section_id,
      totalObtained: 0,
      totalMaximum: 0,
      passed: true,
    };
    const obtained = Number(row.obtained_marks);
    result.totalObtained += obtained;
    result.totalMaximum += Number(row.maximum_marks);
    result.passed &&= obtained >= getEffectivePassingMarks(row.maximum_marks, row.passing_marks);
    students.set(key, result);
  }

  const ranksByClassSection = new Map<string, StudentExamResult[]>();
  for (const student of students.values()) {
    const groupKey = `${student.examId}:${student.classId}:${student.sectionId ?? "unassigned"}`;
    const group = ranksByClassSection.get(groupKey) ?? [];
    group.push(student);
    ranksByClassSection.set(groupKey, group);
  }

  const positions = new Map<string, number>();
  for (const group of ranksByClassSection.values()) {
    group.sort((left, right) => {
      const leftPercentage = left.totalMaximum > 0 ? left.totalObtained / left.totalMaximum : 0;
      const rightPercentage = right.totalMaximum > 0 ? right.totalObtained / right.totalMaximum : 0;
      return rightPercentage - leftPercentage || left.studentId.localeCompare(right.studentId);
    });
    let previousPercentage: number | null = null;
    let currentRank = 0;
    group.forEach((student, index) => {
      const percentage = student.totalMaximum > 0 ? student.totalObtained / student.totalMaximum : 0;
      if (previousPercentage === null || percentage !== previousPercentage) currentRank = index + 1;
      positions.set(`${student.examId}:${student.studentId}`, currentRank);
      previousPercentage = percentage;
    });
  }

  return { studentResults: [...students.values()], positions };
}

export function calculatePublishedResultStatistics(rows: PublishedResultMark[]) {
  const outcomes = getPublishedResultStudentOutcomes(rows);
  const passed = outcomes.filter((student) => student.passed).length;
  return {
    students: outcomes.length,
    passed,
    failed: outcomes.length - passed,
    positionHolders: outcomes.filter((student) => student.position <= 3).length,
  };
}

export function getPublishedResultStudentOutcomes(rows: PublishedResultMark[]): PublishedStudentOutcome[] {
  const { studentResults, positions } = aggregateStudentExamResults(rows);
  return studentResults.map((student) => ({
    examId: student.examId,
    studentId: student.studentId,
    passed: student.passed,
    position: positions.get(`${student.examId}:${student.studentId}`) ?? Infinity,
  }));
}
