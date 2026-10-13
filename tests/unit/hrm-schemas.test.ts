import { describe, expect, it } from "vitest";

import { candidateStageSchema, hireSubjectAssignmentsSchema, interviewSchema, jobOpeningSchema } from "../../src/lib/hrm/schemas";

describe("HRM recruitment validation", () => {
  it("requires a job title and validates supported employment and posting states", () => {
    expect(jobOpeningSchema.safeParse({ title: "Teacher", employeeType: "teacher", employmentType: "full_time", status: "open" }).success).toBe(true);
    expect(jobOpeningSchema.safeParse({ title: "Teacher", employeeType: "staff", employmentType: "full_time", status: "open" }).success).toBe(true);
    expect(jobOpeningSchema.safeParse({ title: "", employeeType: "teacher", employmentType: "full_time", status: "open" }).success).toBe(false);
    expect(jobOpeningSchema.safeParse({ title: "Teacher", employeeType: "principal", employmentType: "full_time", status: "open" }).success).toBe(false);
    expect(jobOpeningSchema.safeParse({ title: "Teacher", employeeType: "teacher", employmentType: "seasonal", status: "open" }).success).toBe(false);
  });

  it("only accepts known hiring stages", () => {
    expect(candidateStageSchema.safeParse({ candidateId: "d9428888-122b-4f71-bdf3-57db2058e358", stage: "hired" }).success).toBe(false);
    expect(candidateStageSchema.safeParse({ candidateId: "d9428888-122b-4f71-bdf3-57db2058e358", stage: "offer", jobId: "8a4b8d2d-8793-4025-a6a6-a11f5addf1ce" }).success).toBe(true);
    expect(candidateStageSchema.safeParse({ candidateId: "d9428888-122b-4f71-bdf3-57db2058e358", stage: "shortlisted" }).success).toBe(false);
  });

  it("requires a valid interview date and known interview format", () => {
    expect(interviewSchema.safeParse({
      candidateId: "d9428888-122b-4f71-bdf3-57db2058e358",
      scheduledAt: "2026-10-12T08:30:00.000Z",
      interviewType: "video",
    }).success).toBe(true);
    expect(interviewSchema.safeParse({
      candidateId: "d9428888-122b-4f71-bdf3-57db2058e358",
      scheduledAt: "not-a-date",
      interviewType: "video",
    }).success).toBe(false);
  });

  it("requires teacher hires to select a session and one or more unique subject assignments", () => {
    const candidateId = "d9428888-122b-4f71-bdf3-57db2058e358";
    const sessionId = "a9428888-122b-4f71-bdf3-57db2058e358";
    const subjectId = "b9428888-122b-4f71-bdf3-57db2058e358";
    expect(hireSubjectAssignmentsSchema.safeParse({
      candidateId,
      employeeType: "teacher",
      academicSessionId: sessionId,
      subjectAssignments: [{ subjectId, classId: "" }],
    }).success).toBe(true);
    expect(hireSubjectAssignmentsSchema.safeParse({
      candidateId,
      employeeType: "teacher",
      academicSessionId: "",
      subjectAssignments: [],
    }).success).toBe(false);
    expect(hireSubjectAssignmentsSchema.safeParse({
      candidateId,
      employeeType: "teacher",
      academicSessionId: sessionId,
      subjectAssignments: [{ subjectId, classId: "" }, { subjectId, classId: "" }],
    }).success).toBe(false);
    expect(hireSubjectAssignmentsSchema.safeParse({
      candidateId,
      employeeType: "staff",
      academicSessionId: "",
      subjectAssignments: [],
    }).success).toBe(true);
  });
});
