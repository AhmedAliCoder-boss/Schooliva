"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { recordAuditEvent } from "@/lib/audit/logging";
import { accountProfileSchema, getAccountProfileValidationError } from "@/lib/auth/account-profile-schema";
import { isMasterAdminUser } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const passwordSchema = z.object({
  schoolId: z.string().uuid(),
  userId: z.string().uuid(),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).refine((values) => values.password === values.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

async function getManagedSchool(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, requestedSchoolId: string) {
  const isMasterAdmin = await isMasterAdminUser(supabase, userId);
  const managementPath = isMasterAdmin ? "/admin/accounts" : "/users";
  if (isMasterAdmin) {
    const { data: school, error } = await supabase.from("schools").select("id").eq("id", requestedSchoolId).maybeSingle();
    return !error && school ? { schoolId: school.id, managementPath } : null;
  }

  const context = await getActiveSchoolContext(supabase, userId);
  if (!context.schoolId || context.schoolId !== requestedSchoolId) return null;

  const { data, error } = await supabase.rpc("has_permission", {
    target_school_id: context.schoolId,
    target_resource: "users",
    target_action: "manage",
  });
  return !error && data === true ? { schoolId: context.schoolId, managementPath } : null;
}

export async function updateSchoolUserProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const isMasterAdmin = await isMasterAdminUser(supabase, user.id);
  const accountPath = isMasterAdmin ? "/admin/accounts" : "/users";
  const targetUserId = z.string().uuid().safeParse(formData.get("userId"));
  if (!targetUserId.success) redirect(`${accountPath}?error=invalid-user-reference`);

  const submittedSchoolId = z.string().uuid().safeParse(formData.get("schoolId"));
  let resolvedSchoolId: string | null = null;
  if (isMasterAdmin) {
    const { data: memberships, error: membershipError } = await supabase
      .from("user_roles")
      .select("school_id")
      .eq("user_id", targetUserId.data);
    if (membershipError) redirect(`${accountPath}?error=school-lookup-failed`);
    const schoolIds = [...new Set((memberships ?? []).map((membership) => membership.school_id).filter(Boolean))];
    const matchingSchoolId = submittedSchoolId.success && schoolIds.includes(submittedSchoolId.data)
      ? submittedSchoolId.data
      : null;
    if (matchingSchoolId) {
      resolvedSchoolId = matchingSchoolId;
    } else if (schoolIds.length === 1) {
      resolvedSchoolId = schoolIds[0];
    } else {
      redirect(`${accountPath}?error=school-selection-required`);
    }
  } else {
    const context = await getActiveSchoolContext(supabase, user.id);
    const contextSchoolId = z.string().uuid().safeParse(context.schoolId);
    if (!contextSchoolId.success) redirect(`${accountPath}?error=school-selection-required`);
    resolvedSchoolId = contextSchoolId.data;
  }

  const parsed = accountProfileSchema.safeParse({
    schoolId: resolvedSchoolId,
    userId: targetUserId.data,
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    phone: formData.get("phone") ?? "",
    roleId: formData.get("roleId"),
  });
  if (!parsed.success) {
    redirect(`${accountPath}?error=${getAccountProfileValidationError(parsed.error.issues)}`);
  }
  const management = await getManagedSchool(supabase, user.id, parsed.data.schoolId);
  if (!management) redirect("/dashboard?error=not-authorized");
  const { schoolId, managementPath } = management;
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) redirect(`${managementPath}?error=admin-auth-not-configured`);

  const { data: authAccount, error: authAccountError } = await adminClient.auth.admin.getUserById(parsed.data.userId);
  if (authAccountError || !authAccount.user) redirect(`${managementPath}?error=account-auth-unavailable`);

  const { error } = await supabase.rpc("update_school_user_profile", {
    target_school_id: schoolId,
    target_user_id: parsed.data.userId,
    target_full_name: parsed.data.fullName,
    target_username: parsed.data.username,
    target_phone: parsed.data.phone,
    target_role_id: parsed.data.roleId,
  });
  if (error) {
    const message = error.code === "PGRST202" || error.message.includes("update_school_user_profile")
      ? "Database migration pending. Admin account management ko enable karne ke liye latest Supabase migration apply karein."
      : error.message.includes("profiles_username_key")
      ? "Ye username kisi aur account ke paas hai."
      : error.message.includes("not authorized") || error.message.includes("not a member")
        ? "Is account ko manage karne ki permission nahi hai."
        : "Account update nahi ho saka. Details check karke dobara try karein.";
    redirect(`${managementPath}?error=${encodeURIComponent(message)}`);
  }

  const [{ data: updatedProfile, error: profileReadError }, { data: updatedMembership, error: membershipReadError }] = await Promise.all([
    supabase.from("profiles").select("full_name,username,phone").eq("id", parsed.data.userId).maybeSingle(),
    supabase.from("user_roles").select("role_id").eq("user_id", parsed.data.userId).eq("school_id", schoolId).eq("role_id", parsed.data.roleId).maybeSingle(),
  ]);
  if (profileReadError || membershipReadError || !updatedProfile || !updatedMembership
    || updatedProfile.full_name !== parsed.data.fullName
    || updatedProfile.username !== parsed.data.username
    || (updatedProfile.phone ?? "") !== parsed.data.phone) {
    redirect(`${managementPath}?error=profile-update-not-verified`);
  }

  const { data: updatedAuth, error: metadataError } = await adminClient.auth.admin.updateUserById(parsed.data.userId, {
    user_metadata: {
      ...authAccount.user.user_metadata,
      full_name: parsed.data.fullName,
      username: parsed.data.username,
    },
  });
  if (metadataError || updatedAuth.user.user_metadata.username !== parsed.data.username) {
    redirect(`${managementPath}?warning=login-username-sync-failed`);
  }

  const { error: auditError } = await recordAuditEvent(supabase, {
    schoolId,
    actorId: user.id,
    action: "update",
    entityType: "user_profile",
    entityId: parsed.data.userId,
    metadata: { fields: ["full_name", "username", "phone", "role", "auth_username"] },
  });
  revalidatePath("/users");
  revalidatePath("/admin/accounts");
  revalidatePath("/dashboard");
  if (auditError) redirect(`${managementPath}?warning=audit-failed`);
  redirect(`${managementPath}?success=profile-updated`);
}

export async function setSchoolUserPassword(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const parsed = passwordSchema.safeParse({
    schoolId: formData.get("schoolId"),
    userId: formData.get("userId"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success || parsed.data.userId === user.id) redirect("/admin/accounts?error=invalid-password");
  const management = await getManagedSchool(supabase, user.id, parsed.data.schoolId);
  if (!management) redirect("/dashboard?error=not-authorized");
  const { schoolId, managementPath } = management;

  const { data: memberships, error: membershipError } = await supabase
    .from("user_roles")
    .select("user_id,roles(slug)")
    .eq("user_id", parsed.data.userId)
    .eq("school_id", schoolId)
    .limit(10);
  if (membershipError || !memberships?.length) redirect(`${managementPath}?error=account-not-found`);
  if (memberships.some((membership) => {
    const roles = Array.isArray(membership.roles) ? membership.roles : [membership.roles];
    return roles.some((role) => role && ["super_admin", "master_admin"].includes(String(role.slug)));
  })) redirect(`${managementPath}?error=protected-account`);

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) redirect(`${managementPath}?error=admin-auth-not-configured`);

  const { error } = await adminClient.auth.admin.updateUserById(parsed.data.userId, {
    password: parsed.data.password,
  });
  if (error) redirect(`${managementPath}?error=password-update-failed`);

  const { error: auditError } = await recordAuditEvent(supabase, {
    schoolId,
    actorId: user.id,
    action: "set_password",
    entityType: "user_account",
    entityId: parsed.data.userId,
    metadata: { method: "admin_set" },
  });
  revalidatePath("/users");
  revalidatePath("/admin/accounts");
  if (auditError) redirect(`${managementPath}?warning=password-audit-failed`);
  redirect(`${managementPath}?success=password-updated`);
}
