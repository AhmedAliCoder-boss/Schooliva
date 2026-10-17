import { describe, expect, it } from "vitest";

import { certificateReviewSchema, certificateSchema, characterCertificateSchema, nextFourDigitCertificateNumber, slcTcSchema } from "../../src/lib/documents/schemas";

describe("SLC/TC certificate validation", () => {
  it("accepts bonafide and enrollment certificate requests with database UUIDs", () => {
    const certificate = {
      studentId: "60000000-0000-0000-0000-000000000002",
      certificateNumber: "B-2026-001",
      issuedOn: "2026-10-15",
      content: "",
    };
    expect(certificateSchema.safeParse({ ...certificate, certificateType: "bonafide" }).success).toBe(true);
    expect(certificateSchema.safeParse({ ...certificate, certificateType: "enrollment" }).success).toBe(true);
    expect(certificateSchema.safeParse({ ...certificate, studentId: "not-a-uuid", certificateType: "bonafide" }).success).toBe(false);
  });

  const certificate = {
    studentId: "d9428888-122b-4f71-bdf3-57db2058e358",
    certificateTitle: "School Leaving Certificate",
    certificateNumber: "0001",
    issuedOn: "2026-10-14",
    dateOfLeaving: "2026-10-14",
    dateOfAdmission: "2020-04-01",
    dateOfBirth: "2012-06-15",
    lastClassSection: "d9428888-122b-4f71-bdf3-57db2058e358|d9428888-122b-4f71-bdf3-57db2058e358",
    academicSessionId: "d9428888-122b-4f71-bdf3-57db2058e358",
    reasonForLeaving: "Family relocation",
    conduct: "Good",
    feeStatus: "cleared",
    lastExamId: "",
    promotionStatus: "Promoted",
    remarks: "",
  };

  it("accepts complete SLC/TC details with a valid date range", () => {
    expect(slcTcSchema.safeParse(certificate).success).toBe(true);
    expect(slcTcSchema.safeParse({ ...certificate, certificateTitle: "Transfer Certificate" }).success).toBe(true);
    expect(slcTcSchema.safeParse({ ...certificate, certificateTitle: "School Completion Certificate" }).success).toBe(true);
    expect(slcTcSchema.safeParse({ ...certificate, academicSessionId: "" }).success).toBe(true);
    expect(slcTcSchema.safeParse({ ...certificate, academicSessionId: "stale-browser-session-value" }).success).toBe(true);
  });

  describe("character certificate validation", () => {
    const certificate = {
      studentId: "d9428888-122b-4f71-bdf3-57db2058e358",
      certificateNumber: "0002",
      issuedOn: "2026-10-14",
      conduct: "Good",
      certificateText: "The student's conduct and character were good.",
      remarks: "",
    };

    it("accepts a complete character certificate", () => {
      expect(characterCertificateSchema.safeParse(certificate).success).toBe(true);
    });

    it("requires a valid student, certificate date, conduct, and statement", () => {
      expect(characterCertificateSchema.safeParse({ ...certificate, studentId: "bad" }).success).toBe(false);
      expect(characterCertificateSchema.safeParse({ ...certificate, issuedOn: "2026-02-30" }).success).toBe(false);
      expect(characterCertificateSchema.safeParse({ ...certificate, conduct: "" }).success).toBe(false);
      expect(characterCertificateSchema.safeParse({ ...certificate, certificateText: " " }).success).toBe(false);
    });
  });

  it("rejects invalid identity, date, fee status, and leaving date", () => {
    expect(slcTcSchema.safeParse({ ...certificate, studentId: "not-a-uuid" }).success).toBe(false);
    expect(slcTcSchema.safeParse({ ...certificate, dateOfBirth: "2012-02-30" }).success).toBe(false);
    expect(slcTcSchema.safeParse({ ...certificate, dateOfLeaving: "2019-12-31" }).success).toBe(false);
    expect(slcTcSchema.safeParse({ ...certificate, feeStatus: "unknown" }).success).toBe(false);
    expect(slcTcSchema.safeParse({ ...certificate, certificateNumber: "SLC-001" }).success).toBe(false);
    expect(slcTcSchema.safeParse({ ...certificate, lastClassSection: "not-a-class|not-a-section" }).success).toBe(false);
    expect(slcTcSchema.safeParse({ ...certificate, promotionStatus: "Passed" }).success).toBe(false);
    expect(slcTcSchema.safeParse({ ...certificate, reasonForLeaving: " " }).success).toBe(false);
  });

  it("generates the next ascending four-digit certificate number", () => {
    expect(nextFourDigitCertificateNumber(["0001", "0003", "CHAR-2026-001"])).toBe("0004");
    expect(nextFourDigitCertificateNumber(["0001"])).toBe("0002");
    expect(nextFourDigitCertificateNumber(["0001", "0002", "0004"])).toBe("0005");
    expect(nextFourDigitCertificateNumber(Array.from({ length: 9999 }, (_, index) => String(index + 1).padStart(4, "0")))).toBeNull();
  });

  it("validates principal certificate review decisions", () => {
    const review = {
      certificateId: "d9428888-122b-4f71-bdf3-57db2058e358",
      decision: "approve",
      notes: "",
    };
    expect(certificateReviewSchema.safeParse(review).success).toBe(true);
    expect(certificateReviewSchema.safeParse({ ...review, decision: "defer" }).success).toBe(false);
    expect(certificateReviewSchema.safeParse({ ...review, certificateId: "bad" }).success).toBe(false);
  });
});
