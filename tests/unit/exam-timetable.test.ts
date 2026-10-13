import { describe, expect, it } from "vitest";

import { examScheduleSchema, examSchema, marksSubmissionSchema } from "../../src/lib/exams/schemas";

const validSchedule = {
  examId: "30000000-0000-0000-0000-000000000001",
  examSubjectId: "40000000-0000-0000-0000-000000000001",
  sectionId: "50000000-0000-0000-0000-000000000001",
  academicTermId: "60000000-0000-0000-0000-000000000001",
  examinerTeacherId: "70000000-0000-0000-0000-000000000001",
  scheduledOn: "2026-11-12",
  startsAt: "09:00",
  endsAt: "10:00",
  room: "Hall A",
};

describe("examScheduleSchema", () => {
  it("accepts a schedule with class, section, term, examiner and valid times", () => {
    expect(examScheduleSchema.safeParse(validSchedule).success).toBe(true);
  });

  it("accepts PostgreSQL UUID formats and optional room", () => {
    expect(examScheduleSchema.safeParse({ ...validSchedule, room: "" }).success).toBe(true);
  });

  it("requires an examiner and term and rejects invalid times", () => {
    expect(examScheduleSchema.safeParse({ ...validSchedule, examinerTeacherId: "" }).success).toBe(false);
    expect(examScheduleSchema.safeParse({ ...validSchedule, academicTermId: "" }).success).toBe(false);
    expect(examScheduleSchema.safeParse({ ...validSchedule, endsAt: "08:00" }).success).toBe(false);
    expect(examScheduleSchema.safeParse({ ...validSchedule, scheduledOn: "2026-02-30" }).success).toBe(false);
  });

  describe("marksSubmissionSchema", () => {
    const record = { studentId: "80000000-0000-0000-0000-000000000001", obtainedMarks: 10 };

    it("requires unique student records", () => {
      expect(marksSubmissionSchema.safeParse({
        examSubjectId: "40000000-0000-0000-0000-000000000001",
        sectionId: "50000000-0000-0000-0000-000000000001",
        records: [record, { ...record }],
      }).success).toBe(false);
    });
  });
});

describe("examSchema", () => {
  const validExam = {
    examTypeId: "30000000-0000-0000-0000-000000000001",
    academicSessionId: "40000000-0000-0000-0000-000000000001",
    gradingScaleId: "",
    name: "Mid Term",
    startsOn: "2026-11-01",
    endsOn: "2026-11-12",
  };

  it("accepts valid exam dates and an optional grading scale", () => {
    expect(examSchema.safeParse(validExam).success).toBe(true);
  });

  it("rejects invalid date formats and an end date before the start date", () => {
    expect(examSchema.safeParse({ ...validExam, startsOn: "11/01/2026" }).success).toBe(false);
    expect(examSchema.safeParse({ ...validExam, startsOn: "2026-02-30" }).success).toBe(false);
    expect(examSchema.safeParse({ ...validExam, endsOn: "2026-10-31" }).success).toBe(false);
  });
});
