import { describe, expect, it } from "vitest";

import { platformAnnouncementSchema } from "../../src/lib/notifications/schemas";

describe("platform notification campaigns", () => {
  const validCampaign = {
    schoolIds: ["9bc4ab17-7870-460b-b637-32bb2d735302"],
    roleSlugs: ["school_admin"],
    title: "Platform update",
    message: "Please review this update.",
  };

  it("accepts a valid targeted campaign", () => {
    expect(platformAnnouncementSchema.safeParse(validCampaign).success).toBe(true);
  });

  it("accepts PostgreSQL UUID values even when they do not use RFC version and variant bits", () => {
    expect(platformAnnouncementSchema.safeParse({
      ...validCampaign,
      schoolIds: ["20000000-0000-0000-0000-000000000001"],
    }).success).toBe(true);
  });

  it("requires at least one active school and role audience", () => {
    expect(platformAnnouncementSchema.safeParse({ ...validCampaign, schoolIds: [] }).success).toBe(false);
    expect(platformAnnouncementSchema.safeParse({ ...validCampaign, roleSlugs: [] }).success).toBe(false);
  });

  it("rejects malformed school ids and overlong campaign copy", () => {
    expect(platformAnnouncementSchema.safeParse({ ...validCampaign, schoolIds: ["not-a-uuid"] }).success).toBe(false);
    expect(platformAnnouncementSchema.safeParse({ ...validCampaign, title: "x".repeat(161) }).success).toBe(false);
    expect(platformAnnouncementSchema.safeParse({ ...validCampaign, message: "x".repeat(1201) }).success).toBe(false);
  });
});
