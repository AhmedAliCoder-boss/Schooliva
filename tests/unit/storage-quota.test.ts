import { describe, expect, it } from "vitest";

import { getStorageQuotaStatus } from "../../src/lib/storage/quota";

describe("storage quota status", () => {
  it("marks healthy usage below the warning threshold", () => {
    expect(getStorageQuotaStatus(400, 1000)).toMatchObject({
      status: "healthy",
      percentage: 40,
      remainingBytes: 600,
    });
  });

  it("marks usage near the cap as warning", () => {
    expect(getStorageQuotaStatus(850, 1000)).toMatchObject({
      status: "warning",
      percentage: 85,
      remainingBytes: 150,
    });
  });

  it("marks full or over-cap usage as critical", () => {
    expect(getStorageQuotaStatus(1200, 1000)).toMatchObject({
      status: "critical",
      percentage: 100,
      remainingBytes: 0,
    });
  });

  it("treats missing quotas as unlimited", () => {
    expect(getStorageQuotaStatus(500, 0)).toMatchObject({
      status: "unlimited",
      quotaBytes: 0,
      percentage: 0,
    });
  });
});
