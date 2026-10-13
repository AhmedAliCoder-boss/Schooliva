import { describe, expect, it } from "vitest";

import { leaveDecisionSchema, leaveRequestSchema, leaveTypeSchema } from "../../src/lib/leave/schemas";

describe("leave management validation", () => {
  const request = {
    leaveTypeId: "d9428888-122b-4f71-bdf3-57db2058e358",
    subjectType: "teacher",
    subjectId: "a9428888-122b-4f71-bdf3-57db2058e358",
    startDate: "2026-10-12",
    endDate: "2026-10-14",
    reason: "Medical appointment",
    attachmentPath: "",
  };

  it("validates the selected person, date range, and bounded reason", () => {
    expect(leaveRequestSchema.safeParse(request).success).toBe(true);
    expect(leaveRequestSchema.safeParse({ ...request, subjectType: "candidate" }).success).toBe(false);
    expect(leaveRequestSchema.safeParse({ ...request, startDate: "2026-02-30" }).success).toBe(false);
    expect(leaveRequestSchema.safeParse({ ...request, startDate: "2026-10-15" }).success).toBe(false);
    expect(leaveRequestSchema.safeParse({ ...request, reason: " " }).success).toBe(false);
    expect(leaveRequestSchema.safeParse({ ...request, reason: "r".repeat(2001) }).success).toBe(false);
  });

  it("bounds leave type and approver input", () => {
    expect(leaveTypeSchema.safeParse({ name: "Annual", description: "Paid leave" }).success).toBe(true);
    expect(leaveTypeSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(leaveTypeSchema.safeParse({ name: "A".repeat(81) }).success).toBe(false);
    expect(leaveDecisionSchema.safeParse({ leaveRequestId: request.leaveTypeId, status: "approved", approverNote: "" }).success).toBe(true);
    expect(leaveDecisionSchema.safeParse({ leaveRequestId: request.leaveTypeId, status: "pending" }).success).toBe(false);
    expect(leaveDecisionSchema.safeParse({ leaveRequestId: request.leaveTypeId, status: "rejected", approverNote: "n".repeat(1001) }).success).toBe(false);
  });
});
