export type PlatformBillingModel = "monthly" | "annual" | "custom";

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value ? date : null;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDaysToDate(value: string, days: number) {
  const date = parseDate(value);
  if (!date || !Number.isInteger(days)) throw new Error("A valid date and whole number of days are required.");
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

export function getBillingPeriodEnd(startDate: string, model: PlatformBillingModel, customEndDate?: string | null) {
  const start = parseDate(startDate);
  if (!start) throw new Error("A valid contract start date is required.");
  const termEnd = customEndDate ? parseDate(customEndDate) : null;
  if (customEndDate && (!termEnd || termEnd < start)) {
    throw new Error("The contract end date must not precede its start date.");
  }
  if (model === "custom") {
    if (termEnd) return formatDate(termEnd);
    return formatDate(start);
  }

  const monthOffset = model === "annual" ? 12 : 1;
  const nextMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + monthOffset, 1));
  const lastDay = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0)).getUTCDate();
  const periodEnd = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), Math.min(start.getUTCDate(), lastDay)));
  periodEnd.setUTCDate(periodEnd.getUTCDate() - 1);
  return formatDate(termEnd && termEnd < periodEnd ? termEnd : periodEnd);
}

export function getPlatformInvoiceAmount(model: PlatformBillingModel, monthlyAmount: number) {
  if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) {
    throw new Error("A positive contract amount is required to generate a platform invoice.");
  }
  return Math.round(monthlyAmount * (model === "annual" ? 12 : 1) * 100) / 100;
}
