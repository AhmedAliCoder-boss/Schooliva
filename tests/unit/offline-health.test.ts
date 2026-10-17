import { describe, expect, it } from "vitest";

import { GET } from "../../src/app/api/offline/health/route";

describe("offline connection health endpoint", () => {
  it("reports app availability without requiring an authenticated session", async () => {
    const response = await GET();

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
