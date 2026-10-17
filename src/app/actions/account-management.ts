"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { isMasterAdminUser } from "@/lib/auth/roles";
import { isSupportedProfileImage } from "@/lib/security/profile-image";
import type { AccountActionState } from "@/lib/admin/account-action-state";

const uuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  "Enter a valid UUID.",
);
const accountStatusSchema = z.enum(["active", "inactive", "suspended"]);
const SCHOOL_ADMIN_CREATABLE_ROLE_SLUGS = [
  "teacher",
  "accountant",
  "hr_manager",
  "librarian",
  "transport_manager",
  "cafeteria_manager",
  "staff",
] as const;
const passwordSchema = z.object({
  userId: uuidSchema,
  schoolId: uuidSchema.nullable(),
  password: z.string().min(12).max(128)
    .regex(/[A-Za-z]/, "Password must contain a letter.")
    .regex(/[0-9]/, "Password must contain a number.")
    .regex(/[^A-Za-z0-9]/, "Password must contain a symbol."),
  confirmPassword: z.string().min(12).max(128),
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

const accountDetailsSchema = z.object({
  schoolId: uuidSchema,
  userId: uuidSchema,
  applicationUserId: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9._-]+$/),
  username: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9._-]+$/),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40),
  roleId: uuidSchema,
});

const createAccountSchema = z.object({
  schoolId: uuidSchema,
  applicationUserId: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9._-]+$/),
  username: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9._-]+$/),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40),
  roleId: uuidSchema,
  password: z.string().min(12).max(128)
    .regex(/[A-Za-z]/, "Password must contain a letter.")
    .regex(/[0-9]/, "Password must contain a number.")
    .regex(/[^A-Za-z0-9]/, "Password must contain a symbol."),
  confirmPassword: z.string().min(12).max(128),
  status: accountStatusSchema,
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

function errorState(message: string): AccountActionState {
  return { status: "error", message };
}

function successState(message: string): AccountActionState {
  return { status: "success", message };
}

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function describeMutationError(error: { code?: string; message?: string } | null, fallback: string) {
  if (error?.code === "23505") return "That User ID or username is already assigned to another account.";
  const message = error?.message ?? "";
  if (message.includes("Not authorized")) return "You are not authorized to manage this account.";
  if (message.includes("Platform administrator accounts are protected")) return message;
  if (message.includes("not a member")) return "This account is not assigned to the selected school.";
  if (message.includes("not available")) return "The selected role is not available for this school.";
  if (message.includes("User ID must")) return "User ID must be 3-40 characters using letters, numbers, dots, dashes, or underscores.";
  if (message.includes("Username must")) return "Username must be 3-30 characters using letters, numbers, dots, dashes, or underscores.";
  if (message.includes("Full name must")) return "Full name must be between 2 and 120 characters.";
  if (message.includes("Invalid account status")) return "Choose a valid account status.";
  if (message.includes("does not exist")) return "The account could not be found.";
  return fallback;
}

async function getActor() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, isMasterAdmin: false };

  const { data: active, error: statusError } = await supabase.rpc("is_account_active", { target_user_id: user.id });
  if (statusError || active !== true) return { supabase, user: null, isMasterAdmin: false };

  return { supabase, user, isMasterAdmin: await isMasterAdminUser(supabase, user.id) };
}

async function canManageSchool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  isMasterAdmin: boolean,
) {
  if (isMasterAdmin) {
    const { data, error } = await supabase.from("schools").select("id").eq("id", schoolId).maybeSingle();
    return !error && Boolean(data);
  }

  const { data, error } = await supabase.rpc("has_permission", {
    target_school_id: schoolId,
    target_resource: "users",
    target_action: "manage",
  });
  return !error && data === true;
}

async function canManageAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string | null,
  isMasterAdmin: boolean,
  userId?: string,
) {
  if (!schoolId) return isMasterAdmin;
  if (isMasterAdmin) return canManageSchool(supabase, schoolId, true);
  if (!userId) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { schoolId: activeSchoolId } = await getActiveSchoolContext(supabase, user.id);
  if (activeSchoolId !== schoolId) return false;
  const { data, error } = await supabase.rpc("can_manage_account", {
    target_school_id: schoolId,
    target_user_id: userId,
  });
  return !error && data === true;
}

async function isProtectedAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("roles!inner(slug)")
    .eq("user_id", userId);
  if (error) return { protected: true, error: true };

  const protectedRole = (data ?? []).some((row) => {
    const value = (row as { roles?: unknown }).roles;
    const roles = Array.isArray(value) ? value : [value];
    return roles.some((role) => {
      if (!role || typeof role !== "object") return false;
      const slug = (role as { slug?: string }).slug;
      return slug === "super_admin" || slug === "master_admin";
    });
  });
  return { protected: protectedRole, error: false };
}

function revalidateAccountSurfaces(userId?: string) {
  revalidatePath("/admin/accounts");
  revalidatePath("/admin");
  revalidatePath("/users");
  revalidatePath("/dashboard");
  if (userId) revalidatePath(`/admin/accounts/${userId}`);
}

async function writeAccountAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  schoolId: string | null,
  action: string,
  metadata: Record<string, string>,
) {
  return supabase.rpc("write_account_audit", {
    target_user_id: userId,
    target_school_id: schoolId,
    target_action: action,
    target_result: "success",
    target_metadata: metadata,
  });
}

async function storeProfilePhoto(
  adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  userId: string,
  file: File,
) {
  if (file.size > 5 * 1024 * 1024) return { error: "Profile photos must be 5 MB or smaller.", path: null };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return { error: "Use a JPEG, PNG, or WebP image.", path: null };
  }
  if (!await isSupportedProfileImage(file)) return { error: "The profile photo content does not match its image type.", path: null };

  const { data: previous, error: previousError } = await adminClient
    .from("profiles")
    .select("avatar_path")
    .eq("id", userId)
    .maybeSingle();
  if (previousError || !previous) return { error: "The profile could not be loaded before the upload.", path: null };

  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await adminClient.storage.from("profile-avatars").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return { error: uploadError.message, path: null };

  const { error: profileError } = await adminClient.from("profiles").update({ avatar_path: path }).eq("id", userId);
  if (profileError) {
    const { error: cleanupError } = await adminClient.storage.from("profile-avatars").remove([path]);
    return {
      error: cleanupError
        ? "The photo could not be saved, and its uploaded file could not be removed."
        : "The photo could not be saved; its uploaded file was removed.",
      path: null,
    };
  }

  if (previous.avatar_path && previous.avatar_path !== path) {
    const { error: removeError } = await adminClient.storage.from("profile-avatars").remove([previous.avatar_path]);
    if (removeError) return { error: "The new photo is active, but the previous image could not be removed.", path };
  }
  return { error: null, path };
}

export async function createManagedAccount(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const actor = await getActor();
  if (!actor.user) return errorState("Sign in with an active administrator account to create users.");

  const parsed = createAccountSchema.safeParse({
    schoolId: readText(formData, "schoolId"),
    applicationUserId: readText(formData, "applicationUserId"),
    username: readText(formData, "username"),
    firstName: readText(formData, "firstName"),
    lastName: readText(formData, "lastName"),
    fullName: readText(formData, "fullName"),
    email: readText(formData, "email"),
    phone: readText(formData, "phone"),
    roleId: readText(formData, "roleId"),
    password: readText(formData, "password"),
    confirmPassword: readText(formData, "confirmPassword"),
    status: readText(formData, "status"),
  });
  if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? "Check the account details and try again.");

  const profilePhoto = formData.get("profilePhoto");
  if (profilePhoto instanceof File && profilePhoto.size > 0) {
    if (profilePhoto.size > 5 * 1024 * 1024) return errorState("Profile photos must be 5 MB or smaller.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(profilePhoto.type)) return errorState("Use a JPEG, PNG, or WebP image.");
    if (!await isSupportedProfileImage(profilePhoto)) return errorState("The profile photo content does not match its image type.");
  }

  if (!await canManageSchool(actor.supabase, parsed.data.schoolId, actor.isMasterAdmin)) {
    return errorState("You are not authorized to create accounts in this school.");
  }

  if (!actor.isMasterAdmin) {
    const { schoolId: activeSchoolId } = await getActiveSchoolContext(actor.supabase, actor.user.id);
    if (activeSchoolId !== parsed.data.schoolId) {
      return errorState("School Admins can only create accounts for their currently selected school.");
    }

    const [{ data: actorRoles, error: actorRolesError }, { data: targetRole, error: targetRoleError }] = await Promise.all([
      actor.supabase.from("user_roles").select("roles!inner(slug)")
        .eq("user_id", actor.user.id).eq("school_id", parsed.data.schoolId),
      actor.supabase.from("roles").select("slug,school_id").eq("id", parsed.data.roleId).maybeSingle(),
    ]);
    if (actorRolesError || targetRoleError) {
      console.error("Could not verify School Admin account-creation scope.", actorRolesError ?? targetRoleError);
      return errorState("School Admin account permissions could not be verified.");
    }
    const canCreateForSchool = (actorRoles ?? []).some((row) => {
      const value = (row as { roles?: unknown }).roles;
      const roles = Array.isArray(value) ? value : [value];
      return roles.some((role) => role && typeof role === "object" && "slug" in role && role.slug === "school_admin");
    });
    if (!canCreateForSchool) return errorState("Only a School Admin can directly create school accounts.");
    if (
      !targetRole
      || (targetRole.school_id != null && targetRole.school_id !== parsed.data.schoolId)
      || !SCHOOL_ADMIN_CREATABLE_ROLE_SLUGS.includes(targetRole.slug as (typeof SCHOOL_ADMIN_CREATABLE_ROLE_SLUGS)[number])
    ) {
      return errorState("School Admins can only create Teacher, Staff, Accountant, HR, Library, Transport, or Cafeteria accounts for their school.");
    }
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) return errorState("Server-side Supabase Auth administration is not configured.");

  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) return errorState("Account invitations are not configured with a trusted site URL.");
  const { data: created, error: authError } = await adminClient.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${origin.replace(/\/+$/, "")}/auth/callback?next=/dashboard`,
    data: {
      full_name: parsed.data.fullName,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      username: parsed.data.username,
    },
  });
  if (authError || !created.user) {
    return errorState(authError?.message ?? "Supabase Auth did not return the invited account.");
  }

  const { error: passwordError } = await adminClient.auth.admin.updateUserById(created.user.id, {
    password: parsed.data.password,
  });
  if (passwordError) {
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(created.user.id);
    return errorState(cleanupError
      ? "The Auth invitation was created, but its password could not be set and the partial account could not be removed."
      : `The Auth invitation was rolled back because its password could not be set: ${passwordError.message}`);
  }

  /* The initial password is sent only to Supabase Auth and is never written to app data. */
  const userId = created.user.id;
  const { error: membershipError } = await actor.supabase.rpc("create_managed_account", {
    target_school_id: parsed.data.schoolId,
    target_user_id: userId,
    target_application_user_id: parsed.data.applicationUserId,
    target_username: parsed.data.username,
    target_first_name: parsed.data.firstName,
    target_last_name: parsed.data.lastName,
    target_full_name: parsed.data.fullName,
    target_phone: parsed.data.phone,
    target_role_id: parsed.data.roleId,
    target_account_status: parsed.data.status,
  });

  if (membershipError) {
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(userId);
    if (cleanupError) {
      const { error: blockError } = await adminClient.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
      const rollbackDetail = blockError
        ? "The partial Auth account could not be blocked automatically. Contact support urgently."
        : "The incomplete Auth account has been blocked; clean-up still needs administrator attention.";
      return errorState(`${describeMutationError(membershipError, "Account creation failed.")} ${rollbackDetail}`);
    }
    return errorState(describeMutationError(membershipError, "Account creation failed; the new Auth account was rolled back."));
  }

  if (parsed.data.status !== "active") {
    const { error: banError } = await adminClient.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    if (banError) {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      return errorState(deleteError
        ? "The account was created but could not be blocked or removed. Contact support urgently."
        : `The incomplete account was rolled back because Supabase Auth could not apply the disabled status: ${banError.message}`);
    }
  }

  const [
    { data: authCheck, error: authCheckError },
    { data: profileCheck, error: profileCheckError },
    { data: membershipCheck, error: membershipCheckError },
  ] = await Promise.all([
    adminClient.auth.admin.getUserById(userId),
    adminClient.from("profiles").select("id,application_user_id,username,account_status").eq("id", userId).maybeSingle(),
    adminClient.from("user_roles").select("user_id,school_id,role_id").eq("user_id", userId).eq("school_id", parsed.data.schoolId).eq("role_id", parsed.data.roleId).maybeSingle(),
  ]);

  if (
    authCheckError || !authCheck.user
    || profileCheckError || !profileCheck
    || membershipCheckError || !membershipCheck
    || profileCheck.application_user_id !== parsed.data.applicationUserId
    || profileCheck.username !== parsed.data.username
    || profileCheck.account_status !== parsed.data.status
  ) {
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(userId);
    return errorState(cleanupError
      ? "Account creation could not be verified and the incomplete account could not be removed. Contact support."
      : "Account creation could not be verified; the new Auth account was rolled back.");
  }

  if (profilePhoto instanceof File && profilePhoto.size > 0) {
    const photoResult = await storeProfilePhoto(adminClient, userId, profilePhoto);
    if (photoResult.error) {
      revalidateAccountSurfaces(userId);
      return errorState(`The account was created, but its profile photo was not saved: ${photoResult.error}`);
    }
    const audit = await writeAccountAudit(actor.supabase, userId, parsed.data.schoolId, "profile_photo_changed", {
      file_type: profilePhoto.type,
    });
    if (audit.error) {
      revalidateAccountSurfaces(userId);
      return errorState("The account and photo were saved, but the photo audit entry failed. Contact support.");
    }
  }

  revalidateAccountSurfaces(userId);
  return successState("User created and verified in Supabase Auth, profile, school membership, and role. Supabase sent an account invitation.");
}

export async function resolveHrmEmployeeAccountRequest(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = z.object({
    requestId: uuidSchema,
    decision: z.enum(["approve", "reject"]),
  }).safeParse({
    requestId: readText(formData, "requestId"),
    decision: readText(formData, "decision"),
  });
  if (!parsed.success) return errorState("Choose a valid employee account request.");

  const actor = await getActor();
  if (!actor.user || !actor.isMasterAdmin) {
    return errorState("Only an active Master Admin can review employee account requests.");
  }
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) return errorState("Server-side Supabase Auth administration is not configured.");

  const { data: request, error: requestError } = await adminClient.from("hrm_account_requests")
    .select("id,employee_type,employee_id,employee_code,school_id,requested_role_id,email,username,status")
    .eq("id", parsed.data.requestId)
    .maybeSingle();
  if (requestError) {
    console.error("Could not load HRM employee account request.", requestError);
    return errorState("The employee account request could not be loaded.");
  }
  if (!request || request.status !== "pending") return errorState("This request is no longer pending.");

  if (parsed.data.decision === "reject") {
    const { error } = await actor.supabase.rpc("resolve_hrm_employee_account_request", {
      p_request_id: request.id,
      p_approve: false,
      p_account_user_id: null,
    });
    if (error) {
      console.error("Could not reject HRM employee account request.", error);
      return errorState("The employee account request could not be rejected.");
    }
    revalidatePath("/admin/accounts/requests");
    revalidatePath(request.employee_type === "teacher" ? `/teachers/${request.employee_id}` : `/staff/${request.employee_id}`);
    return successState("Employee account request rejected.");
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) return errorState("Account invitations are not configured with a trusted site URL.");
  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(request.email, {
    redirectTo: `${origin.replace(/\/+$/, "")}/auth/callback?next=/dashboard`,
    data: {
      username: request.username,
      employee_code: request.employee_code,
      school_id: request.school_id,
    },
  });
  if (inviteError || !invited.user) {
    console.error("Could not invite the requested employee account.", inviteError);
    return errorState(inviteError?.message ?? "Supabase Auth did not return the invited employee account.");
  }

  const { error: resolveError } = await actor.supabase.rpc("resolve_hrm_employee_account_request", {
    p_request_id: request.id,
    p_approve: true,
    p_account_user_id: invited.user.id,
  });
  if (resolveError) {
    console.error("Could not finish approving the HRM employee account request.", resolveError);
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(invited.user.id);
    return errorState(cleanupError
      ? "The request could not be completed and the invited Auth account could not be removed. Contact support."
      : "The request could not be completed; its invited Auth account was rolled back.");
  }

  revalidatePath("/admin/accounts/requests");
  revalidatePath("/admin/accounts");
  revalidatePath("/users");
  revalidatePath(request.employee_type === "teacher" ? `/teachers/${request.employee_id}` : `/staff/${request.employee_id}`);
  revalidatePath("/hrm/candidates");
  return successState("Employee account created and invitation sent.");
}

export async function updateManagedAccount(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const actor = await getActor();
  if (!actor.user) return errorState("Sign in with an active administrator account to edit users.");

  const parsed = accountDetailsSchema.safeParse({
    schoolId: readText(formData, "schoolId"),
    userId: readText(formData, "userId"),
    applicationUserId: readText(formData, "applicationUserId"),
    username: readText(formData, "username"),
    firstName: readText(formData, "firstName"),
    lastName: readText(formData, "lastName"),
    fullName: readText(formData, "fullName"),
    phone: readText(formData, "phone"),
    roleId: readText(formData, "roleId"),
  });
  if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? "Check the account details and try again.");

  if (!await canManageAccount(actor.supabase, parsed.data.schoolId, actor.isMasterAdmin, parsed.data.userId)) {
    return errorState("You are not authorized to manage accounts in this school.");
  }
  const protection = await isProtectedAccount(actor.supabase, parsed.data.userId);
  if (protection.error) return errorState("The account protection status could not be verified.");
  if (protection.protected) return errorState("Platform administrator accounts are protected.");

  const { error } = await actor.supabase.rpc("update_managed_account", {
    target_school_id: parsed.data.schoolId,
    target_user_id: parsed.data.userId,
    target_application_user_id: parsed.data.applicationUserId,
    target_username: parsed.data.username,
    target_first_name: parsed.data.firstName,
    target_last_name: parsed.data.lastName,
    target_full_name: parsed.data.fullName,
    target_phone: parsed.data.phone,
    target_role_id: parsed.data.roleId,
  });
  if (error) return errorState(describeMutationError(error, "The account could not be updated."));

  const { data: profile, error: profileError } = await actor.supabase
    .from("profiles")
    .select("application_user_id,username,first_name,last_name,full_name,phone")
    .eq("id", parsed.data.userId)
    .maybeSingle();
  const { data: membership, error: membershipError } = await actor.supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", parsed.data.userId)
    .eq("school_id", parsed.data.schoolId)
    .eq("role_id", parsed.data.roleId)
    .maybeSingle();
  if (
    profileError || membershipError || !profile || !membership
    || profile.application_user_id !== parsed.data.applicationUserId
    || profile.username !== parsed.data.username
    || profile.full_name !== parsed.data.fullName
  ) {
    return errorState("The update ran, but its saved profile and membership could not be verified. Refresh before retrying.");
  }

  revalidateAccountSurfaces(parsed.data.userId);
  return successState("User profile, User ID, username, and school role were saved.");
}

export async function changeManagedAccountEmail(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const actor = await getActor();
  if (!actor.user) return errorState("Sign in with an active administrator account to change an email.");

  const targetUserId = uuidSchema.safeParse(readText(formData, "userId"));
  const schoolValue = readText(formData, "schoolId");
  const schoolId = schoolValue ? uuidSchema.safeParse(schoolValue) : { success: true as const, data: null };
  const email = z.string().trim().email().max(254).safeParse(readText(formData, "email"));
  if (!targetUserId.success || !schoolId.success || !email.success) return errorState("Enter a valid account and email address.");
  if (!await canManageAccount(actor.supabase, schoolId.data, actor.isMasterAdmin, targetUserId.data)) return errorState("You are not authorized to change this account email.");
  const protection = await isProtectedAccount(actor.supabase, targetUserId.data);
  if (protection.error) return errorState("The account protection status could not be verified.");
  if (protection.protected) return errorState("Platform administrator accounts are protected.");

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) return errorState("Server-side Supabase Auth administration is not configured.");
  const { data: authAccount, error: readError } = await adminClient.auth.admin.getUserById(targetUserId.data);
  if (readError || !authAccount.user) return errorState("The target account could not be loaded from Supabase Auth.");

  const { error } = await adminClient.auth.admin.updateUserById(targetUserId.data, { email: email.data });
  if (error) return errorState(error.message);

  const audit = await writeAccountAudit(actor.supabase, targetUserId.data, schoolId.data, "email_change_requested", {});
  revalidateAccountSurfaces(targetUserId.data);
  if (audit.error) {
    return errorState("Supabase Auth accepted the email change, but the audit entry failed. Contact support before retrying.");
  }
  return successState("Email change requested in Supabase Auth. The account must complete any confirmation email before the new address is active.");
}

export async function setManagedAccountPassword(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const actor = await getActor();
  if (!actor.user) return errorState("Sign in with an active administrator account to change passwords.");

  const parsed = passwordSchema.safeParse({
    userId: readText(formData, "userId"),
    schoolId: readText(formData, "schoolId") || null,
    password: readText(formData, "password"),
    confirmPassword: readText(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    const invalidReference = parsed.error.issues.some((issue) => issue.path[0] === "userId" || issue.path[0] === "schoolId");
    if (invalidReference) return errorState("The account reference is invalid. Refresh the page and try again.");
    return errorState(parsed.error.issues[0]?.message ?? "Enter a valid new password.");
  }
  if (parsed.data.userId === actor.user.id) return errorState("Use the secure password reset flow to change your own password.");
  if (!await canManageAccount(actor.supabase, parsed.data.schoolId, actor.isMasterAdmin, parsed.data.userId)) return errorState("You are not authorized to change this account password.");

  const protection = await isProtectedAccount(actor.supabase, parsed.data.userId);
  if (protection.error) return errorState("The account protection status could not be verified.");
  if (protection.protected) return errorState("Platform administrator accounts are protected.");

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) return errorState("Server-side Supabase Auth administration is not configured.");
  const { data: changed, error } = await adminClient.auth.admin.updateUserById(parsed.data.userId, {
    password: parsed.data.password,
  });
  if (error || !changed.user) return errorState(error?.message ?? "Supabase Auth did not confirm the password update.");

  const audit = await writeAccountAudit(actor.supabase, parsed.data.userId, parsed.data.schoolId, "password_changed", {
    method: "admin_set",
  });
  revalidateAccountSurfaces(parsed.data.userId);
  if (audit.error) return errorState("Supabase Auth changed the password, but the audit entry failed. Contact support.");
  return successState("Password updated successfully.");
}

export async function changeManagedAccountStatus(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const actor = await getActor();
  if (!actor.user) return errorState("Sign in with an active administrator account to change account status.");
  const userId = uuidSchema.safeParse(readText(formData, "userId"));
  const schoolValue = readText(formData, "schoolId");
  const schoolId = schoolValue ? uuidSchema.safeParse(schoolValue) : { success: true as const, data: null };
  const status = accountStatusSchema.safeParse(readText(formData, "status"));
  if (!userId.success || !schoolId.success || !status.success) return errorState("Choose a valid account and status.");
  if (!await canManageAccount(actor.supabase, schoolId.data, actor.isMasterAdmin, userId.data)) return errorState("You are not authorized to change this account status.");
  const protection = await isProtectedAccount(actor.supabase, userId.data);
  if (protection.error) return errorState("The account protection status could not be verified.");
  if (protection.protected) return errorState("Platform administrator accounts are protected.");

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) return errorState("Server-side Supabase Auth administration is not configured.");
  const { data: oldProfile, error: oldProfileError } = await adminClient
    .from("profiles")
    .select("account_status")
    .eq("id", userId.data)
    .maybeSingle();
  if (oldProfileError || !oldProfile) return errorState("The target account status could not be loaded.");
  if (userId.data === actor.user.id && status.data !== "active") return errorState("You cannot deactivate or suspend your own account.");

  if (status.data !== "active") {
    const { error: banError } = await adminClient.auth.admin.updateUserById(userId.data, { ban_duration: "876000h" });
    if (banError) return errorState(banError.message);
  }

  const { error: statusError } = await actor.supabase.rpc("set_managed_account_status", {
    target_user_id: userId.data,
    target_school_id: schoolId.data,
    target_account_status: status.data,
  });
  if (statusError) {
    let compensationMessage = "";
    if (status.data !== "active") {
      const previousBan = oldProfile.account_status === "active" ? "none" : "876000h";
      const { error: rollbackError } = await adminClient.auth.admin.updateUserById(userId.data, { ban_duration: previousBan });
      if (rollbackError) compensationMessage = " The Auth rollback failed; access remains blocked pending support.";
    }
    return errorState(`${describeMutationError(statusError, "The status update failed.")}${compensationMessage}`);
  }

  if (status.data === "active") {
    const { error: unbanError } = await adminClient.auth.admin.updateUserById(userId.data, { ban_duration: "none" });
    if (unbanError) {
      const { error: rollbackError } = await actor.supabase.rpc("set_managed_account_status", {
        target_user_id: userId.data,
        target_school_id: schoolId.data,
        target_account_status: oldProfile.account_status,
      });
      return errorState(rollbackError
        ? "The account could not be reactivated in Supabase Auth or rolled back in the profile. Access remains denied; contact support."
        : `Profile status was reverted because Supabase Auth reactivation failed: ${unbanError.message}`);
    }
  }

  const { data: verified, error: verifyError } = await adminClient
    .from("profiles")
    .select("account_status")
    .eq("id", userId.data)
    .maybeSingle();
  if (verifyError || verified?.account_status !== status.data) {
    return errorState("The account status changed but could not be verified. Refresh and contact support before retrying.");
  }

  revalidateAccountSurfaces(userId.data);
  return successState(`Account status changed to ${status.data}.`);
}

export async function moveManagedAccountSchool(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const actor = await getActor();
  if (!actor.user || !actor.isMasterAdmin) return errorState("Only an active Master Admin can move an account between schools.");
  const userId = uuidSchema.safeParse(readText(formData, "userId"));
  const sourceSchoolValue = readText(formData, "sourceSchoolId");
  const sourceSchoolId = sourceSchoolValue ? uuidSchema.safeParse(sourceSchoolValue) : { success: true as const, data: null };
  const destinationSchoolId = uuidSchema.safeParse(readText(formData, "destinationSchoolId"));
  const roleId = uuidSchema.safeParse(readText(formData, "roleId"));
  if (!userId.success || !sourceSchoolId.success || !destinationSchoolId.success || !roleId.success) {
    return errorState("Choose a valid account, source school, destination school, and role.");
  }
  const protection = await isProtectedAccount(actor.supabase, userId.data);
  if (protection.error) return errorState("The account protection status could not be verified.");
  if (protection.protected) return errorState("Platform administrator accounts are protected.");

  const { error } = await actor.supabase.rpc("move_managed_account", {
    target_user_id: userId.data,
    source_school_id: sourceSchoolId.data,
    destination_school_id: destinationSchoolId.data,
    destination_role_id: roleId.data,
  });
  if (error) return errorState(describeMutationError(error, "The school membership could not be moved."));

  revalidateAccountSurfaces(userId.data);
  return successState("School membership moved. Historical records remain associated with their original school.");
}

export async function uploadManagedAccountPhoto(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const actor = await getActor();
  if (!actor.user) return errorState("Sign in with an active account to upload a profile photo.");
  const userId = uuidSchema.safeParse(readText(formData, "userId"));
  const schoolId = uuidSchema.safeParse(readText(formData, "schoolId"));
  const file = formData.get("profilePhoto");
  if (!userId.success || !(file instanceof File) || file.size === 0) return errorState("Choose a profile photo to upload.");

  const ownProfile = userId.data === actor.user.id;
  if (!ownProfile && (!schoolId.success || !await canManageAccount(actor.supabase, schoolId.data, actor.isMasterAdmin, userId.data))) {
    return errorState("You are not authorized to change this profile photo.");
  }
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) return errorState("Server-side Supabase Storage administration is not configured.");
  const photoResult = await storeProfilePhoto(adminClient, userId.data, file);
  if (photoResult.error) return errorState(photoResult.error);

  const audit = await writeAccountAudit(
    actor.supabase,
    userId.data,
    ownProfile ? null : (schoolId.data ?? null),
    "profile_photo_changed",
    { file_type: file.type },
  );
  revalidateAccountSurfaces(userId.data);
  if (audit.error) return errorState("The profile photo changed, but its audit entry failed. Contact support.");
  return successState("Profile photo updated.");
}
