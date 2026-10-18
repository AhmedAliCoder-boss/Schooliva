export function getPreviousPakistanMonth(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const previousMonth = new Date(Date.UTC(year, month - 2, 1));
  const previousYear = previousMonth.getUTCFullYear();
  const previousMonthNumber = previousMonth.getUTCMonth() + 1;
  const pakistanOffsetMs = 5 * 60 * 60 * 1000;
  const start = new Date(Date.UTC(previousYear, previousMonthNumber - 1, 1) - pakistanOffsetMs);
  const end = new Date(Date.UTC(year, month - 1, 1) - pakistanOffsetMs);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label: new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Karachi",
      month: "long",
      year: "numeric",
    }).format(previousMonth),
  };
}

export function normalizeWhatsAppPhone(value: string) {
  let digits = value.trim().replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;

  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function buildMonthlyWhatsAppMessage({
  asOfDate,
  promotionMonth,
  outstandingAmount,
  unpaidBillCount,
  overdueBillCount,
  schoolsWithDues,
  promotions,
}: {
  asOfDate: string;
  promotionMonth: string;
  outstandingAmount: string;
  unpaidBillCount: number;
  overdueBillCount: number;
  schoolsWithDues: number;
  promotions: number;
}) {
  return [
    `Schooliva monthly platform summary — ${asOfDate}`,
    "",
    "Payment status (current):",
    `• Outstanding: ${outstandingAmount} across ${unpaidBillCount} unpaid bill(s) at ${schoolsWithDues} school(s).`,
    `• Overdue bills: ${overdueBillCount}.`,
    "",
    `Academic promotions completed in ${promotionMonth}: ${promotions}.`,
    "",
    "Review the Admin Billing and school Promotion pages for details.",
  ].join("\n");
}

export function buildWhatsAppHref(phone: string, message: string) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  if (!normalizedPhone) return null;

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
