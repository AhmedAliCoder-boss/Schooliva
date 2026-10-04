import { describe, expect, it } from "vitest";

import { getAuthErrorMessage } from "../../src/lib/auth/messages";

describe("authentication error messages", () => {
  it("explains that the updated username is accepted and role names are not login IDs", () => {
    expect(getAuthErrorMessage("Invalid login credentials")).toContain("updated login username");
    expect(getAuthErrorMessage("Invalid login credentials")).toContain("role name");
  });
});
