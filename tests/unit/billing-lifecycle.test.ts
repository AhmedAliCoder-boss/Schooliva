import { describe, expect, it } from "vitest";

import { describeContractLifecycle } from "../../src/lib/billing-lifecycle";

describe("billing lifecycle summaries", () => {
  it("marks active contracts as live and ready", () => {
    expect(describeContractLifecycle("active", null)).toMatchObject({
      status: "active",
      label: "Active",
      isLive: true,
    });
  });

  it("marks cancelled contracts as closed", () => {
    expect(describeContractLifecycle("cancelled", null)).toMatchObject({
      status: "cancelled",
      label: "Cancelled",
      isLive: false,
    });
  });

  it("flags a paused contract as pending renewal", () => {
    expect(describeContractLifecycle("paused", "2026-11-01")).toMatchObject({
      status: "paused",
      label: "Paused",
      renewalDate: "2026-11-01",
      isLive: false,
    });
  });
});
