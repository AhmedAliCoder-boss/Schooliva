import { describe, expect, it } from "vitest";

import { copyBatchSchema, copyStatusSchema, issueSchema, memberSchema, memberStatusSchema, returnSchema } from "../../src/lib/library/schemas";

const id = "d9428888-122b-4f71-bdf3-57db2058e358";

describe("library workflow validation", () => {
  it("validates bounded batches of uniquely prefixed copies", () => {
    expect(copyBatchSchema.safeParse({ bookId: id, prefix: "LIB-", quantity: "12" }).success).toBe(true);
    expect(copyBatchSchema.safeParse({ bookId: id, prefix: "LIB_%", quantity: "12" }).success).toBe(false);
    expect(copyBatchSchema.safeParse({ bookId: id, prefix: "LIB-", quantity: "101" }).success).toBe(false);
  });

  it("requires a linked member matching the selected member type", () => {
    expect(memberSchema.safeParse({ memberType: "student", studentId: id, membershipNumber: "STU-1" }).success).toBe(true);
    expect(memberSchema.safeParse({ memberType: "teacher", teacherId: id, membershipNumber: "T-1" }).success).toBe(true);
    expect(memberSchema.safeParse({ memberType: "student", teacherId: id, membershipNumber: "STU-1" }).success).toBe(false);
    expect(memberSchema.safeParse({ memberType: "student", studentId: id, teacherId: id, membershipNumber: "STU-1" }).success).toBe(false);
  });

  it("validates issue dates, return fines, and member status actions", () => {
    expect(issueSchema.safeParse({ copyId: id, memberId: id, dueDate: "2026-11-01" }).success).toBe(true);
    expect(issueSchema.safeParse({ copyId: id, memberId: id, dueDate: "2026-02-30" }).success).toBe(false);
    expect(returnSchema.safeParse({ transactionId: id, fineAmount: "15.50" }).success).toBe(true);
    expect(returnSchema.safeParse({ transactionId: id, fineAmount: "-1" }).success).toBe(false);
    expect(memberStatusSchema.safeParse({ memberId: id, status: "blocked" }).success).toBe(true);
    expect(memberStatusSchema.safeParse({ memberId: id, status: "deleted" }).success).toBe(false);
    expect(copyStatusSchema.safeParse({ copyId: id, status: "damaged", conditionNote: "Cover torn" }).success).toBe(true);
    expect(copyStatusSchema.safeParse({ copyId: id, status: "issued", conditionNote: "" }).success).toBe(false);
  });
});
