export function filterCustomerSchoolRows<T extends { school_id?: string | null }>(
  rows: T[] | null | undefined,
  customerSchoolIds?: Array<string | null | undefined>,
): T[] {
  const allowedSchoolIds = new Set(
    (customerSchoolIds ?? []).map((schoolId) => String(schoolId)).filter(Boolean),
  );

  const safeRows = rows ?? [];

  return safeRows.filter((row) => {
    const schoolId = row?.school_id;

    if (schoolId === null || schoolId === undefined || String(schoolId).trim() === "") {
      return false;
    }

    if (allowedSchoolIds.size === 0) {
      return true;
    }

    return allowedSchoolIds.has(String(schoolId));
  });
}
