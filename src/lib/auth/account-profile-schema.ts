import { z } from "zod";

export const accountProfileSchema = z.object({
  schoolId: z.string().uuid(),
  userId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  firstName: z.string().trim().max(80),
  lastName: z.string().trim().max(80),
  applicationUserId: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/),
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/),
  phone: z.string().trim().max(40),
  roleId: z.string().uuid(),
});

export function getAccountProfileValidationError(issues: Array<{ path: PropertyKey[] }>) {
  const invalidFields = new Set(issues.map((issue) => issue.path[0]));
  if (invalidFields.has("applicationUserId")) return "invalid-application-user-id";
  if (invalidFields.has("username")) return "invalid-username";
  if (invalidFields.has("fullName")) return "invalid-full-name";
  if (invalidFields.has("roleId")) return "invalid-role";
  if (invalidFields.has("phone")) return "invalid-phone";
  if (invalidFields.has("schoolId")) return "invalid-school-reference";
  if (invalidFields.has("userId")) return "invalid-user-reference";
  return "invalid-account-details";
}
