import { describe, expect, it } from "vitest";

import { postgresUuidSchema } from "../../src/lib/admissions/schemas";

describe("admission database identifiers", () => {
  it("accepts PostgreSQL UUIDs without requiring an RFC version or variant", () => {
    expect(postgresUuidSchema.safeParse("50000000-0000-0000-0000-000000000001").success).toBe(true);
    expect(postgresUuidSchema.safeParse("00000000-0000-0000-0000-000000000000").success).toBe(true);
  });

  it("rejects values that are not in PostgreSQL UUID format", () => {
    expect(postgresUuidSchema.safeParse("2026-01").success).toBe(false);
    expect(postgresUuidSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});
