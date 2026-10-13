import { describe, expect, it } from "vitest";
import { formatInvoiceNumber } from "../../src/lib/finance/invoice-number";

describe("formatInvoiceNumber", () => {
  it("formats sequential values as short invoice references", () => {
    expect(formatInvoiceNumber(1)).toBe("INV-000001");
    expect(formatInvoiceNumber(42)).toBe("INV-000042");
    expect(formatInvoiceNumber(999_999)).toBe("INV-999999");
  });

  it("rejects invalid sequence values", () => {
    for (const value of [0, -1, 1.5, 1_000_000, "1", null]) {
      expect(() => formatInvoiceNumber(value)).toThrow(RangeError);
    }
  });
});
