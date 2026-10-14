export type TransportStudentOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  admission_number: string | null;
};

export function parseTransportStudentOptions(rows: unknown): TransportStudentOption[] {
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((row: unknown) => {
    if (typeof row !== "object" || row === null || !("id" in row) || typeof row.id !== "string") return [];
    return [{
      id: row.id,
      first_name: "first_name" in row && typeof row.first_name === "string" ? row.first_name : null,
      last_name: "last_name" in row && typeof row.last_name === "string" ? row.last_name : null,
      admission_number: "admission_number" in row && typeof row.admission_number === "string" ? row.admission_number : null,
    }];
  });
}

export function hasTransportStudent(rows: unknown, studentId: string) {
  return parseTransportStudentOptions(rows).some((student) => student.id === studentId);
}
