import { describe, expect, it } from "vitest";

import { formatNotificationDate } from "../../src/lib/notifications/formatting";

describe("notification date formatting", () => {
  it("uses a stable locale and the school's time zone", () => {
    expect(formatNotificationDate("2026-10-13T13:46:36.513224+00:00", "Asia/Karachi"))
      .toBe("13 Oct 2026, 18:46");
  });

  it("returns a fallback for invalid timestamps", () => {
    expect(formatNotificationDate("not-a-date", "UTC")).toBe("Date unavailable");
  });
});
