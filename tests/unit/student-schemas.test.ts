import { describe, expect, it } from "vitest";

import { studentSchema } from "../../src/lib/students/schemas";

describe("student identity input", () => {
  it("does not accept client-provided student or admission identifiers", () => {
    const parsed = studentSchema.safeParse({
      firstName: "Amina",
      lastName: "Khan",
      status: "active",
      admissionNumber: "CUSTOM-123",
      studentIdentifier: "CUSTOM-STUDENT-ID",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("admissionNumber" in parsed.data).toBe(false);
      expect("studentIdentifier" in parsed.data).toBe(false);
    }
  });
});
