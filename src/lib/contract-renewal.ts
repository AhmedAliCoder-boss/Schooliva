export type ContractRenewalWindow = {
  status: string;
  renewalDate: string | null;
  isRenewalDue: boolean;
  warns: boolean;
  requiresAction: boolean;
  daysUntilRenewal: number;
  nextRenewalDate: string | null;
};

export function resolveContractRenewalWindow({
  status,
  renewalDate,
  asOf = new Date(),
}: {
  status?: string | null;
  renewalDate?: string | null;
  asOf?: string | Date;
}): ContractRenewalWindow {
  const normalizedStatus = String(status ?? "").toLowerCase();
  const safeAsOf = new Date(asOf);
  const safeRenewalDate = renewalDate ? new Date(`${renewalDate}T00:00:00Z`) : null;

  if (!safeRenewalDate || !["active", "draft"].includes(normalizedStatus)) {
    return {
      status: normalizedStatus || "draft",
      renewalDate: renewalDate ?? null,
      isRenewalDue: false,
      warns: false,
      requiresAction: false,
      daysUntilRenewal: Number.POSITIVE_INFINITY,
      nextRenewalDate: renewalDate ?? null,
    };
  }

  const diffMs = safeRenewalDate.getTime() - safeAsOf.getTime();
  const daysUntilRenewal = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const isRenewalDue = daysUntilRenewal <= 0;
  const warns = isRenewalDue || (daysUntilRenewal >= 0 && daysUntilRenewal <= 14);

  return {
    status: normalizedStatus || "draft",
    renewalDate: renewalDate ?? null,
    isRenewalDue,
    warns,
    requiresAction: isRenewalDue || warns,
    daysUntilRenewal,
    nextRenewalDate: renewalDate ?? null,
  };
}
