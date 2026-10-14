export type InvoiceFrequency = "monthly" | "quarterly" | "yearly";

function parseDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError("Invoice schedule dates must be valid YYYY-MM-DD values.");
  }
  return date;
}

export function invoiceScheduleDate(anchorDate: string, frequency: InvoiceFrequency, periodIndex: number): string {
  if (!Number.isInteger(periodIndex) || periodIndex < 0) {
    throw new RangeError("Invoice schedule period index must be a non-negative integer.");
  }
  const anchor = parseDate(anchorDate);
  const monthsPerPeriod = frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : 12;
  const monthIndex = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth() + monthsPerPeriod * periodIndex;
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex % 12;
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(anchor.getUTCDate(), lastDayOfMonth))).toISOString().slice(0, 10);
}

export function dueInvoiceScheduleDates(
  anchorDate: string,
  frequency: InvoiceFrequency,
  throughDate: string,
): string[] {
  parseDate(throughDate);
  const dueDates: string[] = [];
  for (let periodIndex = 0; ; periodIndex += 1) {
    const dueDate = invoiceScheduleDate(anchorDate, frequency, periodIndex);
    if (dueDate > throughDate) return dueDates;
    dueDates.push(dueDate);
  }
}
