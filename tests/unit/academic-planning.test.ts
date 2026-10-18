import { describe, expect, it } from "vitest";

import {
  academicPlanProgressSchema,
  academicPlanSchema,
} from "../../src/lib/curriculum/planning-schemas";

const validPlan = {
  id: "",
  academicSessionId: "0f9f3c8a-07d6-4111-8d72-b5c366f2b92e",
  termId: "",
  classId: "134f3bb4-7423-43e6-91ce-906dbd73ac76",
  subjectId: "35a8f1be-0911-49f8-8259-f4ac81c3ee74",
  teacherId: "",
  unitNumber: "1",
  title: "Fractions and equivalent values",
  learningObjectives: "Students will compare and represent equivalent fractions.",
  keyConcepts: "",
  plannedLessons: "4",
  plannedStartDate: "2026-08-01",
  plannedEndDate: "2026-08-14",
  assessmentPlan: "Exit tickets and an end-of-unit quiz.",
  learningResources: "",
  status: "draft",
};

describe("academic planning validation", () => {
  it("accepts a valid curriculum unit plan and coerces lesson counts", () => {
    const result = academicPlanSchema.safeParse(validPlan);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.plannedLessons).toBe(4);
  });

  it("rejects invalid calendar dates and reversed planning windows", () => {
    expect(academicPlanSchema.safeParse({ ...validPlan, plannedStartDate: "2026-02-31" }).success).toBe(false);
    expect(academicPlanSchema.safeParse({
      ...validPlan,
      plannedStartDate: "2026-08-15",
      plannedEndDate: "2026-08-14",
    }).success).toBe(false);
  });

  it("prevents reporting more completed lessons than the bounded progress count", () => {
    expect(academicPlanProgressSchema.safeParse({
      id: validPlan.academicSessionId,
      completedLessons: "3",
      teacherReflection: "",
    }).success).toBe(true);
    expect(academicPlanProgressSchema.safeParse({
      id: validPlan.academicSessionId,
      completedLessons: "201",
      teacherReflection: "",
    }).success).toBe(false);
  });
});
