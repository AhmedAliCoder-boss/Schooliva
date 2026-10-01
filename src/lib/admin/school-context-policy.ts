export function resolveSelectedSchoolId(
  selectedSchoolId: string | null | undefined,
  membershipSchoolIds: Array<string | null | undefined>
): string | null {
  const validMembershipIds = membershipSchoolIds
    .map((schoolId) => (schoolId == null ? null : String(schoolId).trim()))
    .filter((schoolId): schoolId is string => Boolean(schoolId));

  if (!validMembershipIds.length) {
    return null;
  }

  if (selectedSchoolId) {
    const normalized = String(selectedSchoolId).trim();
    return validMembershipIds.includes(normalized) ? normalized : null;
  }

  return validMembershipIds.length === 1 ? validMembershipIds[0] : null;
}
