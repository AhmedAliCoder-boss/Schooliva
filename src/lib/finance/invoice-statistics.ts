export type InvoiceStatusSummary = {
  count: number;
  amount: number;
};

export type InvoiceStatistics = {
  paid: InvoiceStatusSummary;
  pending: InvoiceStatusSummary;
  partiallyPaid: InvoiceStatusSummary;
};

export function summarizeInvoiceStatuses(
  invoices: Array<{
    status: string;
    total: number;
    paidAmount: number;
    remainingAmount: number;
  }>,
): InvoiceStatistics {
  return invoices.reduce<InvoiceStatistics>((statistics, invoice) => {
    if (invoice.status === "cancelled") return statistics;

    const category = invoice.status === "paid" || invoice.remainingAmount <= 0
      ? statistics.paid
      : invoice.paidAmount > 0 || invoice.status === "partially_paid"
        ? statistics.partiallyPaid
        : statistics.pending;
    category.count += 1;
    category.amount += category === statistics.paid ? invoice.paidAmount : invoice.remainingAmount;
    return statistics;
  }, {
    paid: { count: 0, amount: 0 },
    pending: { count: 0, amount: 0 },
    partiallyPaid: { count: 0, amount: 0 },
  });
}
