import { describe, expect, it } from "vitest";

import { schoolProfileSchema, settingsSchema } from "../../src/lib/setup/schemas";

describe("school setup schemas", () => {
  it("accepts and normalizes the editable school metadata", () => {
    const profile = schoolProfileSchema.parse({
      name: " North School ",
      shortName: "NS",
      slug: "north-school",
      code: "NORTH",
      schoolType: "Public",
      campus: "Main",
      board: "Regional Board",
      medium: "English",
      principal: "A. Principal",
      establishedYear: "2001",
      email: "office@example.edu",
      phone: "",
      website: "https://example.edu",
      address: "Main Road",
      city: "North City",
      state: "North State",
      country: "Pakistan",
    });

    expect(profile.name).toBe("North School");
    expect(profile.establishedYear).toBe(2001);
    expect(profile.state).toBe("North State");
  });

  it("allows optional school metadata to be cleared", () => {
    const profile = schoolProfileSchema.parse({
      name: "North School",
      shortName: "",
      slug: "north-school",
      code: "NORTH",
      schoolType: "",
      campus: "",
      board: "",
      medium: "",
      principal: "",
      establishedYear: "",
      email: "",
      phone: "",
      website: "",
      address: "",
      city: "",
      state: "",
      country: "",
    });

    expect(profile.establishedYear).toBeUndefined();
    expect(profile.shortName).toBe("");
  });

  it("validates regional settings and accepts an optional academic year", () => {
    expect(settingsSchema.parse({
      timezone: "Asia/Karachi",
      currency: "PKR",
      dateFormat: "YYYY-MM-DD",
      academicYear: "2026-2027",
    }).academicYear).toBe("2026-2027");
  });

  it("rejects a malformed website URL and unsupported timezone", () => {
    const invalidProfile = schoolProfileSchema.safeParse({
      name: "North School",
      shortName: "",
      slug: "north-school",
      code: "NORTH",
      schoolType: "",
      campus: "",
      board: "",
      medium: "",
      principal: "",
      establishedYear: "",
      email: "",
      phone: "",
      website: "example.edu",
      address: "",
      city: "",
      state: "",
      country: "",
    });
    const invalidSettings = settingsSchema.safeParse({
      timezone: "Mars/Olympus",
      currency: "PKR",
      dateFormat: "YYYY-MM-DD",
      academicYear: "",
    });

    expect(invalidProfile.success).toBe(false);
    expect(invalidSettings.success).toBe(false);
  });
});
