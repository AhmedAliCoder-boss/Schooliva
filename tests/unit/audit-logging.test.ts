import { describe, expect, it } from "vitest";

import { buildAuditLogPayload } from "../../src/lib/audit/logging";

describe("audit log payload builder", () => {
  it("serializes a tenant action with a known school scope and metadata", () => {
    expect(buildAuditLogPayload({
      schoolId: "11111111-1111-4111-8111-111111111111",
      action: "create",
      entityType: "schools",
      entityId: "22222222-2222-4222-8222-222222222222",
      metadata: { createdBy: "user-1", source: "manual" },
    })).toMatchObject({
      target_school_id: "11111111-1111-4111-8111-111111111111",
      target_action: "create",
      target_entity_type: "schools",
      target_entity_id: "22222222-2222-4222-8222-222222222222",
      target_metadata: { createdBy: "user-1", source: "manual" },
    });
  });

  it("falls back to an empty metadata object for null entries", () => {
    expect(buildAuditLogPayload({
      schoolId: "11111111-1111-4111-8111-111111111111",
      action: "update",
      entityType: "contracts",
    })).toMatchObject({
      target_metadata: {},
    });
  });
});
