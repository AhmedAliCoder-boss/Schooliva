import { describe, expect, it } from "vitest";

import { getAuthorizedNavigationHrefs } from "../../src/lib/navigation/role-navigation";
import { normalizeSchoolRoleSlug, SCHOOL_DASHBOARD_ROLE_SLUGS } from "../../src/lib/auth/roles";

describe("role-based navigation", () => {
  it("always keeps dashboard and profile while exposing only granted modules", () => {
    expect(getAuthorizedNavigationHrefs(["library:view"])).toEqual([
      "/dashboard",
      "/library",
      "/profile",
    ]);
  });

  it("does not expose mutation-only destinations without their matching permission", () => {
    const hrefs = getAuthorizedNavigationHrefs(["students.attendance:view", "fees:view"]);
    expect(hrefs).toContain("/attendance");
    expect(hrefs).toContain("/finance");
    expect(hrefs).not.toContain("/setup");
    expect(hrefs).not.toContain("/users");
  });

  it("recognizes the existing Schooliva dashboard roles and HR role alias", () => {
    expect(SCHOOL_DASHBOARD_ROLE_SLUGS).toContain("super_admin");
    expect(SCHOOL_DASHBOARD_ROLE_SLUGS).toContain("school_admin");
    expect(normalizeSchoolRoleSlug("HR_STAFF_MANAGER")).toBe("hr_manager");
    expect(normalizeSchoolRoleSlug(null)).toBeNull();
  });
});
