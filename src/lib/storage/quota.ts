export type StorageQuotaStatus = "unlimited" | "healthy" | "warning" | "critical";

export function formatStorageBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function getStorageQuotaStatus(usedBytes: number, quotaBytes?: number | null) {
  const safeUsed = Number.isFinite(usedBytes) ? Math.max(0, usedBytes) : 0;
  const safeQuota = Number.isFinite(quotaBytes ?? 0) ? Math.max(0, Number(quotaBytes ?? 0)) : 0;

  if (!safeQuota) {
    return {
      usedBytes: safeUsed,
      quotaBytes: 0,
      remainingBytes: 0,
      percentage: 0,
      status: "unlimited" as StorageQuotaStatus,
    };
  }

  const percentage = Math.min((safeUsed / safeQuota) * 100, 100);
  let status: StorageQuotaStatus = "healthy";

  if (percentage >= 100) status = "critical";
  else if (percentage >= 80) status = "warning";

  return {
    usedBytes: safeUsed,
    quotaBytes: safeQuota,
    remainingBytes: Math.max(safeQuota - safeUsed, 0),
    percentage,
    status,
  };
}
