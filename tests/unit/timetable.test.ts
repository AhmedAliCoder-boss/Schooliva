import { describe, expect, it } from "vitest";

import { buildTimetableGridSlots, timetableGridSlotKey } from "../../src/lib/timetable/grid";
import { timetablePeriodsSchema, timetableSchema, timetableWorkingDaysSchema, weeklyTimetableSelectionSchema } from "../../src/lib/timetable/schemas";

const validEntry = {
  id: "",
  academicSessionId: "dcf80f8d-33c2-4ec5-a572-cb4dc7352627",
  classId: "746a8a9a-80ac-4aaf-86c5-82f6ce9ded84",
  sectionId: "9d6df83d-f6b8-43eb-9bbc-8226476a87ce",
  subjectId: "5843cbc2-ebde-4b77-b866-70f23ed18781",
  teacherId: "e247100a-b903-4d15-b576-34c2a11d11b3",
  periodNumber: "1",
  room: "",
  dayOfWeek: "1",
  status: "active",
};

describe("timetableSchema", () => {
  it("accepts a valid new entry and an optional update ID", () => {
    expect(timetableSchema.safeParse(validEntry).success).toBe(true);
    expect(timetableSchema.safeParse({
      ...validEntry,
      id: "4a633cb7-a888-46f6-86bc-e7bcd85ca143",
    }).success).toBe(true);
  });

  it("accepts PostgreSQL UUIDs whose version and variant bits are not RFC-formatted", () => {
    expect(timetableSchema.safeParse({
      ...validEntry,
      academicSessionId: "30000000-0000-0000-0000-000000000001",
      classId: "40000000-0000-0000-0000-000000000001",
      teacherId: "60000000-0000-0000-0000-000000000002",
    }).success).toBe(true);
  });

  it("rejects invalid days and period numbers", () => {
    expect(timetableSchema.safeParse({ ...validEntry, dayOfWeek: "8" }).success).toBe(false);
    expect(timetableSchema.safeParse({ ...validEntry, periodNumber: "17" }).success).toBe(false);
  });

  it("rejects malformed update IDs", () => {
    expect(timetableSchema.safeParse({ ...validEntry, id: "not-a-uuid" }).success).toBe(false);
  });
});

describe("weeklyTimetableSelectionSchema", () => {
  it("requires valid session, class, and section IDs before loading a weekly schedule", () => {
    expect(weeklyTimetableSelectionSchema.safeParse({
      sessionId: "30000000-0000-0000-0000-000000000001",
      classId: "40000000-0000-0000-0000-000000000001",
      sectionId: "50000000-0000-0000-0000-000000000001",
    }).success).toBe(true);
    expect(weeklyTimetableSelectionSchema.safeParse({
      sessionId: "30000000-0000-0000-0000-000000000001",
      classId: "40000000-0000-0000-0000-000000000001",
      sectionId: "",
    }).success).toBe(false);
  });
});

describe("timetableWorkingDaysSchema", () => {
  it("accepts a single open day and school-specific weekday combinations", () => {
    expect(timetableWorkingDaysSchema.safeParse(["5"]).data).toEqual([5]);
    expect(timetableWorkingDaysSchema.safeParse(["1", "2", "3", "4", "5", "6"]).success).toBe(true);
    expect(timetableWorkingDaysSchema.safeParse(["1", "2", "3", "4", "6", "7"]).success).toBe(true);
  });

  it("requires at least one unique valid day", () => {
    expect(timetableWorkingDaysSchema.safeParse([]).success).toBe(false);
    expect(timetableWorkingDaysSchema.safeParse(["5", "5"]).success).toBe(false);
    expect(timetableWorkingDaysSchema.safeParse(["0"]).success).toBe(false);
    expect(timetableWorkingDaysSchema.safeParse(["8"]).success).toBe(false);
  });
});

describe("timetable grid", () => {
  it("keeps configured periods in order and includes legacy entry slots", () => {
    const slots = buildTimetableGridSlots([
      { period_number: 2, starts_at: "08:45:00", ends_at: "09:25:00" },
      { period_number: null, starts_at: "10:00:00", ends_at: "10:40:00" },
    ], [
      { period_number: 1, name: "Morning", starts_at: "08:00:00", ends_at: "08:40:00" },
      { period_number: 2, name: "Second", starts_at: "08:45:00", ends_at: "09:25:00" },
    ]);

    expect(slots.map((slot) => slot.key)).toEqual(["period-1", "period-2", "legacy-10:00-10:40"]);
    expect(timetableGridSlotKey({ period_number: null, starts_at: "10:00:00", ends_at: "10:40:00" }))
      .toBe("legacy-10:00-10:40");
  });
});

describe("timetablePeriodsSchema", () => {
  it("accepts a configurable, ordered list of non-overlapping periods", () => {
    expect(timetablePeriodsSchema.safeParse([
      { name: "Morning", startsAt: "08:00", endsAt: "08:40" },
      { name: "Second", startsAt: "08:45", endsAt: "09:25" },
    ]).success).toBe(true);
  });

  it("rejects overlapping, unordered, invalid, and excessive periods", () => {
    expect(timetablePeriodsSchema.safeParse([
      { name: "One", startsAt: "08:00", endsAt: "09:00" },
      { name: "Two", startsAt: "08:30", endsAt: "09:30" },
    ]).success).toBe(false);
    expect(timetablePeriodsSchema.safeParse([
      { name: "One", startsAt: "09:00", endsAt: "09:30" },
      { name: "Two", startsAt: "08:00", endsAt: "08:30" },
    ]).success).toBe(false);
    expect(timetablePeriodsSchema.safeParse([
      { name: "", startsAt: "08:00", endsAt: "08:30" },
    ]).success).toBe(false);
    expect(timetablePeriodsSchema.safeParse(Array.from({ length: 17 }, (_, index) => ({
      name: `Period ${index + 1}`,
      startsAt: `${String(index).padStart(2, "0")}:00`,
      endsAt: `${String(index).padStart(2, "0")}:30`,
    }))).success).toBe(false);
  });
});
