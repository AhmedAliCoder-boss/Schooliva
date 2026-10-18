import { describe, expect, it } from "vitest";

import {
  assignmentReviewSchema,
  assignmentSchema,
  assignmentStatusSchema,
  submissionSchema,
} from "../../src/lib/assignments/schemas";
import { curriculumSchema, teacherSubjectSchema } from "../../src/lib/curriculum/schemas";
import { academicPlanSchema } from "../../src/lib/curriculum/planning-schemas";

const id = "0f9f3c8a-07d6-4111-8d72-b5c366f2b92e";
const postgresUuidWithoutRfcVersion = "00000000-0000-0000-0000-000000000000";
const validAssignment = {
  academicSessionId: id,
  classId: id,
  sectionId: id,
  subjectId: id,
  teacherId: id,
  title: "Fractions practice",
  description: "",
  issueDate: "2026-10-18",
  dueDate: "2026-10-21",
  maxMarks: "",
};

describe("assignment workflow validation", () => {
  it("validates classwork dates and treats omitted max marks as unset", () => {
    const result = assignmentSchema.safeParse(validAssignment);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.maxMarks).toBeUndefined();

    expect(assignmentSchema.safeParse({ ...validAssignment, dueDate: "2026-10-17" }).success).toBe(false);
    expect(assignmentSchema.safeParse({ ...validAssignment, dueDate: "2026-02-31" }).success).toBe(false);
    expect(assignmentSchema.safeParse({ ...validAssignment, maxMarks: "1000" }).success).toBe(false);
  });

  it("accepts valid PostgreSQL UUIDs regardless of RFC version bits across academic forms", () => {
    const assignment = assignmentSchema.safeParse({
      ...validAssignment,
      academicSessionId: postgresUuidWithoutRfcVersion,
      classId: postgresUuidWithoutRfcVersion,
      sectionId: postgresUuidWithoutRfcVersion,
      subjectId: postgresUuidWithoutRfcVersion,
      teacherId: postgresUuidWithoutRfcVersion,
    });
    expect(assignment.success).toBe(true);

    expect(curriculumSchema.safeParse({
      academicSessionId: postgresUuidWithoutRfcVersion,
      classId: postgresUuidWithoutRfcVersion,
      subjectId: postgresUuidWithoutRfcVersion,
      credits: "",
      gradingWeight: "",
      status: "active",
    }).success).toBe(true);
    expect(teacherSubjectSchema.safeParse({
      academicSessionId: postgresUuidWithoutRfcVersion,
      teacherId: postgresUuidWithoutRfcVersion,
      subjectId: postgresUuidWithoutRfcVersion,
      classId: "",
    }).success).toBe(true);
    expect(academicPlanSchema.safeParse({
      id: "",
      academicSessionId: postgresUuidWithoutRfcVersion,
      termId: "",
      classId: postgresUuidWithoutRfcVersion,
      subjectId: postgresUuidWithoutRfcVersion,
      teacherId: "",
      unitNumber: "1",
      title: "Unit one",
      learningObjectives: "Students can explain the learning objective.",
      keyConcepts: "",
      plannedLessons: "2",
      plannedStartDate: "2026-10-18",
      plannedEndDate: "2026-10-21",
      assessmentPlan: "A short formative check.",
      learningResources: "",
      status: "planned",
    }).success).toBe(true);
  });

  it("reports an unselected academic session as a selection issue", () => {
    const result = assignmentSchema.safeParse({ ...validAssignment, academicSessionId: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("Select an academic session.");
  });

  it("requires a response id and a non-empty mark or feedback for reviews", () => {
    expect(submissionSchema.safeParse({ assignmentId: id, content: "My answer" }).success).toBe(true);
    expect(assignmentReviewSchema.safeParse({ submissionId: id, marks: "8.5", feedback: "" })).toMatchObject({
      success: true,
      data: { marks: 8.5 },
    });
    expect(assignmentReviewSchema.safeParse({ submissionId: id, marks: "", feedback: "Good work." })).toMatchObject({
      success: true,
      data: { marks: "" },
    });
    expect(assignmentReviewSchema.safeParse({ submissionId: id, marks: "", feedback: "" }).success).toBe(false);
    expect(assignmentReviewSchema.safeParse({ submissionId: id, marks: "1000", feedback: "" }).success).toBe(false);
  });

  it("allows only explicit open or closed state changes", () => {
    expect(assignmentStatusSchema.safeParse({ assignmentId: id, status: "closed" }).success).toBe(true);
    expect(assignmentStatusSchema.safeParse({ assignmentId: id, status: "draft" }).success).toBe(false);
  });
});
