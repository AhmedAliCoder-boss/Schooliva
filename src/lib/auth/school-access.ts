export function resolveAuthorizedSchoolId({
  candidateSchoolId,
  availableSchoolIds,
  isMasterAdmin,
}: {
  candidateSchoolId?: string | null;
  availableSchoolIds?: Array<string | null | undefined>;
  isMasterAdmin?: boolean;
}): string | null {
  const normalizedCandidate = typeof candidateSchoolId === "string" ? candidateSchoolId.trim() : "";
  const normalizedIds = (availableSchoolIds ?? []).map((schoolId) => (typeof schoolId === "string" ? schoolId.trim() : "")).filter(Boolean);

  if (!normalizedCandidate) {
    return null;
  }

  if (isMasterAdmin) {
    if (!normalizedIds.length) return normalizedCandidate;
    return normalizedIds.includes(normalizedCandidate) ? normalizedCandidate : null;
  }

  return normalizedIds.includes(normalizedCandidate) ? normalizedCandidate : null;
}
