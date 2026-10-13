import { describe, expect, it } from "vitest";

import { getActiveHref } from "../../src/lib/navigation/active-path";

describe("getActiveHref", () => {
  const items = [
    { href: "/finance" },
    { href: "/finance/fees" },
    { href: "/finance/invoices" },
    { href: "/students" },
    { href: "/hrm" },
    { href: "/hrm/jobs" },
    { href: "/hrm/candidates" },
    { href: "/hrm/interviews" },
  ];

  it("selects only the most specific matching section", () => {
    expect(getActiveHref("/finance/fees", items)).toBe("/finance/fees");
    expect(getActiveHref("/finance/invoices", items)).toBe("/finance/invoices");
  });

  it("keeps a parent section active for its unmatched nested routes", () => {
    expect(getActiveHref("/finance/reports", items)).toBe("/finance");
    expect(getActiveHref("/finance", items)).toBe("/finance");
  });

  it("does not match unrelated route prefixes", () => {
    expect(getActiveHref("/students/new", items)).toBe("/students");
    expect(getActiveHref("/financial", items)).toBeNull();
  });

  it("selects the specific HRM navigation destination", () => {
    expect(getActiveHref("/hrm", items)).toBe("/hrm");
    expect(getActiveHref("/hrm/jobs", items)).toBe("/hrm/jobs");
    expect(getActiveHref("/hrm/candidates", items)).toBe("/hrm/candidates");
    expect(getActiveHref("/hrm/interviews", items)).toBe("/hrm/interviews");
  });
});
