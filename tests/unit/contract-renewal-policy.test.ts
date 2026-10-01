import { describe, expect, it } from "vitest";

import { resolveContractRenewalWindow } from "../../src/lib/contract-renewal";

describe("contract renewal policy", () => {
  it("flags a contract as renewal due once its renewal date has passed", () => {
    expect(resolveContractRenewalWindow({
      status: "active",
      renewalDate: "2024-01-01",
      asOf: "2024-01-10",
    })).toMatchObject({
      isRenewalDue: true,
      warns: true,
      daysUntilRenewal: -9,
    });
  });

  it("keeps a future renewal window calm when the renewal is still ahead", () => {
    expect(resolveContractRenewalWindow({
      status: "active",
      renewalDate: "2026-11-20",
      asOf: "2026-10-01",
    })).toMatchObject({
      isRenewalDue: false,
      warns: false,
      daysUntilRenewal: 50,
    });
  });

  it("does not require renewal action for paused or cancelled contracts", () => {
    expect(resolveContractRenewalWindow({
      status: "paused",
      renewalDate: "2026-10-15",
      asOf: "2026-10-01",
    })).toMatchObject({
      isRenewalDue: false,
      warns: false,
      requiresAction: false,
    });
  });
});
