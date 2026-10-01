export function describeContractLifecycle(status?: string | null, renewalDate?: string | null) {
  const normalizedStatus = String(status ?? "").toLowerCase();

  const metadata: Record<string, { label: string; isLive: boolean }> = {
    active: { label: "Active", isLive: true },
    draft: { label: "Draft", isLive: false },
    paused: { label: "Paused", isLive: false },
    expired: { label: "Expired", isLive: false },
    cancelled: { label: "Cancelled", isLive: false },
  };

  return {
    status: normalizedStatus || "draft",
    label: metadata[normalizedStatus]?.label ?? "Unknown",
    renewalDate: renewalDate ?? null,
    isLive: metadata[normalizedStatus]?.isLive ?? false,
  };
}
