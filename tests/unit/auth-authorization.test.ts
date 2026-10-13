import { describe, expect, it } from "vitest";

import { isAdminAccountManagerRole, isMasterAdminUser, isSchoolAdminRole, isSchoolStaffRole } from "../../src/lib/auth/roles";

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

  it("detects master-admin assignments by user id", async () => {
    const mockSupabase = {
      auth: { getUser: async () => ({ data: { user: { id: "user-123" } }, error: null }) },
      rpc: async () => ({ data: true, error: null }),
    } as unknown as Parameters<typeof isMasterAdminUser>[0];

    await expect(isMasterAdminUser(mockSupabase, "user-123")).resolves.toBe(true);
    await expect(isMasterAdminUser(mockSupabase, "user-456")).resolves.toBe(false);

    const memberClient = {
      auth: { getUser: async () => ({ data: { user: { id: "user-123" } }, error: null }) },
      rpc: async () => ({ data: false, error: null }),
    } as unknown as Parameters<typeof isMasterAdminUser>[0];
    await expect(isMasterAdminUser(memberClient, "user-123")).resolves.toBe(false);
  });
});

describe("school account directory access", () => {
  it("only recognizes the school admin role for the dashboard section", () => {
    expect(isSchoolAdminRole("school_admin")).toBe(true);
    expect(isSchoolAdminRole("principal")).toBe(false);
    expect(isSchoolAdminRole("super_admin")).toBe(false);
  });

  it("includes school staff roles but excludes student and parent accounts", () => {
    expect(isSchoolStaffRole("teacher")).toBe(true);
    expect(isSchoolStaffRole("transport_manager")).toBe(true);
    expect(isSchoolStaffRole("student")).toBe(false);
    expect(isSchoolStaffRole("parent")).toBe(false);
  });
});
