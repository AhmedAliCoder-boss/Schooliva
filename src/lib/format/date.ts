const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatPlatformDate(value: string | null | undefined, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const day = String(date.getUTCDate()).padStart(2, "0");
  const formatted = `${day} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  if (!includeTime) return formatted;

  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${formatted}, ${hours}:${minutes} UTC`;
}
