export function reconcileInvoiceStatus({
  total,
  paidAmount,
  dueDate,
}: {
  total: number;
  paidAmount: number;
  dueDate?: string | null;
}) {
  const safeTotal = Number(total ?? 0);
  const safePaidAmount = Number(paidAmount ?? 0);
  const remainingAmount = Math.max(safeTotal - safePaidAmount, 0);

  if (remainingAmount <= 0) {
    return { status: "paid", remainingAmount: 0 };
  }

  if (safePaidAmount > 0) {
    return { status: "partially_paid", remainingAmount };
  }

  if (dueDate) {
    const due = new Date(`${dueDate}T00:00:00Z`);
    if (!Number.isNaN(due.getTime()) && due < new Date()) {
      return { status: "overdue", remainingAmount };
    }
  }

  return { status: "unpaid", remainingAmount };
}
