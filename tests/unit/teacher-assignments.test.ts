import { describe, expect, it } from "vitest";

import { getAssignedTeacherIds } from "../../src/lib/academics/teacher-assignments";

describe("getAssignedTeacherIds", () => {
  const assignments = [
    { teacher_id: "school-wide", academic_session_id: "session-a", subject_id: "math", class_id: null },
    { teacher_id: "class-specific", academic_session_id: "session-a", subject_id: "math", class_id: "class-a" },
    { teacher_id: "other-class", academic_session_id: "session-a", subject_id: "math", class_id: "class-b" },
    { teacher_id: "other-session", academic_session_id: "session-b", subject_id: "math", class_id: "class-a" },
    { teacher_id: "other-subject", academic_session_id: "session-a", subject_id: "science", class_id: "class-a" },
  ];

  it("includes school-wide and matching class assignments only for the selected session and subject", () => {
    expect([...getAssignedTeacherIds(assignments, "session-a", "math", "class-a")])
      .toEqual(["school-wide", "class-specific"]);
  });

  it("reuses a school-wide subject assignment across classes without including another class-specific teacher", () => {
    expect([...getAssignedTeacherIds(assignments, "session-a", "math", "class-b")])
      .toEqual(["school-wide", "other-class"]);
  });

  it("returns no teacher for an unknown class", () => {
    expect([...getAssignedTeacherIds(assignments, "session-a", "math", "class-c")])
      .toEqual(["school-wide"]);
  });
});
