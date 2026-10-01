function serializeCsvCell(value: unknown): string {
  const stringValue = value === null || value === undefined ? "" : String(value);

  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function toScalar(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return JSON.stringify(value);
}

function flattenSummaryEntries(summary: Record<string, unknown>, parentSection = ""):
  Array<[string, string, string | number | boolean | null]> {
  const rows: Array<[string, string, string | number | boolean | null]> = [];

  for (const [key, value] of Object.entries(summary)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      rows.push(...flattenSummaryEntries(value as Record<string, unknown>, parentSection ? `${parentSection}.${key}` : key));
      continue;
    }

    const section = parentSection || key;
    const metric = parentSection ? key : "value";
    rows.push([section, metric, toScalar(value)]);
  }

  return rows;
}

export function buildSchoolReportCsv(summary: Record<string, unknown> | null | undefined, schoolName?: string | null): string {
  const payload = summary ?? {};
  const rows: string[] = [];
  rows.push(`school_name,${serializeCsvCell(schoolName ?? (payload.school_name ?? "unknown"))}`);
  rows.push("report_section,metric,value");

  const flattened = flattenSummaryEntries(payload)
    .filter(([section, metric]) => !(section === "school_name" && metric === "value"));

  for (const [section, metric, value] of flattened) {
    rows.push(`${serializeCsvCell(section)},${serializeCsvCell(metric)},${serializeCsvCell(value)}`);
  }

  return `${rows.join("\n")}\n`;
}
