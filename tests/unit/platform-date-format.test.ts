import { describe, expect, it } from "vitest";

import { formatPlatformDate } from "../../src/lib/format/date";

describe("platform date formatting", () => {
  it("formats dates consistently without depending on the browser locale", () => {
    expect(formatPlatformDate("2026-09-17T03:18:14.674287+00:00")).toBe("17 Sep 2026");
  });

  it("formats timestamps in UTC and preserves invalid values", () => {
    expect(formatPlatformDate("2026-09-17T03:18:14.674287+00:00", true)).toBe("17 Sep 2026, 03:18 UTC");
    expect(formatPlatformDate("not-a-date")).toBe("not-a-date");
    expect(formatPlatformDate(null)).toBe("—");
  });
});
