import { describe, expect, it } from "vitest";

import { hasStudentProfileEditRole } from "../../src/lib/students/permissions";

describe("student profile editing permissions", () => {
  it("allows school admins and principals", () => {
    expect(hasStudentProfileEditRole([{ roles: { slug: "school_admin" } }])).toBe(true);
    expect(hasStudentProfileEditRole([{ roles: [{ slug: "principal" }] }])).toBe(true);
  });

  it("does not allow unrelated roles, including platform admins", () => {
    expect(hasStudentProfileEditRole([{ roles: { slug: "teacher" } }])).toBe(false);
    expect(hasStudentProfileEditRole([{ roles: { slug: "super_admin" } }])).toBe(false);
    expect(hasStudentProfileEditRole([{ roles: null }])).toBe(false);
  });
});
