const MAX_INVOICE_SEQUENCE = 999_999;

export function formatInvoiceNumber(sequence: unknown): string {
  if (
    typeof sequence !== "number" ||
    !Number.isInteger(sequence) ||
    sequence < 1 ||
    sequence > MAX_INVOICE_SEQUENCE
  ) {
    throw new RangeError("Invoice sequence must be an integer between 1 and 999999.");
  }
  return `INV-${String(sequence).padStart(6, "0")}`;
}
