export type ReportFilters = {
  from: string;
  to: string;
  classId: string;
  sectionId: string;
  sessionId: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string | null): value is string {
  return Boolean(value && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
}

function validUuid(value: string | null): string {
  return value && UUID_PATTERN.test(value) ? value : "";
}

export function parseReportFilters(params: URLSearchParams, today = new Date().toISOString().slice(0, 10)): ReportFilters {
  const requestedFrom = params.get("from");
  const requestedTo = params.get("to");
  let from = validDate(requestedFrom) ? requestedFrom : "";
  let to = validDate(requestedTo) ? requestedTo : "";
  const daySpan = from && to
    ? (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000
    : 0;

  if (!from || !to || daySpan < 0 || daySpan > 366) {
    to = today;
    from = new Date(Date.parse(`${today}T00:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);
  }

  return {
    from,
    to,
    classId: validUuid(params.get("classId")),
    sectionId: validUuid(params.get("sectionId")),
    sessionId: validUuid(params.get("sessionId")),
  };
}
