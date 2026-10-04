import { z } from "zod";

export const accountProfileSchema = z.object({
  schoolId: z.string().uuid(),
  userId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/),
  phone: z.string().trim().max(40),
  roleId: z.string().uuid(),
});

export function getAccountProfileValidationError(issues: Array<{ path: PropertyKey[] }>) {
  const invalidFields = new Set(issues.map((issue) => issue.path[0]));
  if (invalidFields.has("username")) return "invalid-username";
  if (invalidFields.has("fullName")) return "invalid-full-name";
  if (invalidFields.has("roleId")) return "invalid-role";
  if (invalidFields.has("phone")) return "invalid-phone";
  if (invalidFields.has("schoolId")) return "invalid-school-reference";
  if (invalidFields.has("userId")) return "invalid-user-reference";
  return "invalid-account-details";
}
