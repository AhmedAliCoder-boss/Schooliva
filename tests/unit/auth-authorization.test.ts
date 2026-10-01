import { describe, expect, it } from "vitest";

import { isAdminAccountManagerRole } from "../../src/lib/auth/roles";

describe("account creation authorization", () => {
  it("allows admin role slugs to manage user creation", () => {
    expect(isAdminAccountManagerRole("super_admin")).toBe(true);
    expect(isAdminAccountManagerRole("school_admin")).toBe(true);
    expect(isAdminAccountManagerRole("principal")).toBe(true);
  });

  it("blocks non-admin roles from creating accounts", () => {
    expect(isAdminAccountManagerRole("teacher")).toBe(false);
    expect(isAdminAccountManagerRole("staff")).toBe(false);
    expect(isAdminAccountManagerRole("student")).toBe(false);
    expect(isAdminAccountManagerRole(undefined)).toBe(false);
  });
});
