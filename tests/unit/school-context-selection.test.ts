import { describe, expect, it } from "vitest";

import { resolveSelectedSchoolId } from "../../src/lib/admin/school-context-policy";

describe("school context selection", () => {
  it("prefers the explicitly selected school when it belongs to the user", () => {
    expect(resolveSelectedSchoolId("school-b", ["school-a", "school-b"])).toBe("school-b");
  });

  it("rejects a user-supplied school id that is not in the user membership set", () => {
    expect(resolveSelectedSchoolId("school-z", ["school-a", "school-b"])).toBeNull();
  });

  it("falls back to the only membership when there is no explicit selection", () => {
    expect(resolveSelectedSchoolId(null, ["school-a"])).toBe("school-a");
  });

  it("forces explicit selection when the user belongs to multiple schools", () => {
    expect(resolveSelectedSchoolId(null, ["school-a", "school-b"])).toBeNull();
  });
});
