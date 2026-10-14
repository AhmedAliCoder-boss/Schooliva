import { describe, expect, it } from "vitest";

import { roleAnnouncementSchema } from "../../src/lib/notifications/schemas";

describe("role-based notification validation", () => {
  it("requires a role audience and bounded announcement content", () => {
    expect(roleAnnouncementSchema.safeParse({
      roleSlugs: ["teacher", "parent"],
      title: "Schedule update",
      message: "The school day ends at noon on Friday.",
    }).success).toBe(true);
    expect(roleAnnouncementSchema.safeParse({
      roleSlugs: [],
      title: "Schedule update",
      message: "The school day ends at noon on Friday.",
    }).success).toBe(false);
    expect(roleAnnouncementSchema.safeParse({
      roleSlugs: ["teacher"],
      title: " ",
      message: "Message",
    }).success).toBe(false);
    expect(roleAnnouncementSchema.safeParse({
      roleSlugs: ["teacher"],
      title: "Title",
      message: "m".repeat(1201),
    }).success).toBe(false);
  });
});
