import { describe, expect, it } from "vitest";

import { resolveAuthorizedSchoolId } from "../../src/lib/auth/school-access";

describe("school access authorization", () => {
  it("accepts a school id when the user belongs to it", () => {
    expect(resolveAuthorizedSchoolId({
      candidateSchoolId: "school-b",
      availableSchoolIds: ["school-a", "school-b"],
      isMasterAdmin: false,
    })).toBe("school-b");
  });

  it("rejects a school id when the user is not a member", () => {
    expect(resolveAuthorizedSchoolId({
      candidateSchoolId: "school-z",
      availableSchoolIds: ["school-a", "school-b"],
      isMasterAdmin: false,
    })).toBeNull();
  });

  it("allows a master admin to act on a known school id without membership", () => {
    expect(resolveAuthorizedSchoolId({
      candidateSchoolId: "school-b",
      availableSchoolIds: ["school-a", "school-b"],
      isMasterAdmin: true,
    })).toBe("school-b");
  });

  it("rejects empty or missing school ids for non-master users", () => {
    expect(resolveAuthorizedSchoolId({
      candidateSchoolId: "",
      availableSchoolIds: ["school-a", "school-b"],
      isMasterAdmin: false,
    })).toBeNull();
  });
});
