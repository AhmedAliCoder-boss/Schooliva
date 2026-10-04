import { describe, expect, it } from "vitest";

import { accountProfileSchema, getAccountProfileValidationError } from "../../src/lib/auth/account-profile-schema";

const validProfile = {
  schoolId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  fullName: "School Admin",
  username: "mbs.admin",
  phone: "",
  roleId: "33333333-3333-4333-8333-333333333333",
};

describe("admin account profile validation", () => {
  it("accepts a valid login username", () => {
    expect(accountProfileSchema.safeParse(validProfile).success).toBe(true);
  });

  it.each(["School Admin", "mbs admin", "bad/name", "ab", "a".repeat(31)])(
    "rejects an invalid username and reports a username-specific error",
    (username) => {
      const result = accountProfileSchema.safeParse({ ...validProfile, username });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(getAccountProfileValidationError(result.error.issues)).toBe("invalid-username");
      }
    },
  );

  it.each([
    ["phone", "invalid-phone", "x".repeat(41)],
    ["schoolId", "invalid-school-reference", "invalid"],
    ["userId", "invalid-user-reference", "invalid"],
  ])("identifies an invalid %s field", (field, errorCode, value) => {
    const result = accountProfileSchema.safeParse({ ...validProfile, [field]: value });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(getAccountProfileValidationError(result.error.issues)).toBe(errorCode);
    }
  });
});
