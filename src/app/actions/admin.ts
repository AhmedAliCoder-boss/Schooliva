"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";

import { ADMIN_SCHOOL_COOKIE } from "@/lib/admin/school-context";
import { isMasterAdminUser } from "@/lib/auth/roles";
import { resolveAuthorizedSchoolId } from "@/lib/auth/school-access";
import { reconcileInvoiceStatus } from "@/lib/billing-reconciliation";
import { resolveContractRenewalWindow } from "@/lib/contract-renewal";
import { recordAuditEvent } from "@/lib/audit/logging";
import { sanitizeColor } from "@/lib/school-branding";
import { createClient } from "@/lib/supabase/server";

const schoolSchema = z.object({
  name: z.string().trim().min(2),
  code: z.string().trim().min(2),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  state: z.string().trim().optional().or(z.literal("")),
  country: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
});

const schoolUserSchema = z.object({
  schoolId: z.string().uuid(),
  fullName: z.string().trim().min(2),
  username: z.string().trim().min(3),
  email: z.string().trim().email(),
  password: z.string().min(8),
  roleSlug: z.string().trim().min(2),
});

const resetPasswordSchema = z.object({
  email: z.string().trim().email(),
});

const toggleAccountSchema = z.object({
  userId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
  enabled: z.enum(["true", "false"]),
});

const schoolBrandingSchema = z.object({
  schoolId: z.string().uuid(),
  primaryColor: z.string().trim().default("#2563eb"),
  secondaryColor: z.string().trim().default("#0f172a"),
  accentColor: z.string().trim().default("#f59e0b"),
  backgroundColor: z.string().trim().default("#f8fafc"),
  foregroundColor: z.string().trim().default("#0f172a"),
  cardColor: z.string().trim().default("#ffffff"),
  mutedColor: z.string().trim().default("#64748b"),
  borderColor: z.string().trim().default("#dfe7ee"),
  successColor: z.string().trim().default("#16a34a"),
  warningColor: z.string().trim().default("#f59e0b"),
  destructiveColor: z.string().trim().default("#dc2626"),
  infoColor: z.string().trim().default("#2563eb"),
  themeMode: z.enum(["light", "dark", "system"]).default("light"),
});

const platformContractSchema = z.object({
  schoolId: z.string().uuid(),
  contractNumber: z.string().trim().min(2),
  planName: z.string().trim().min(2),
  status: z.enum(["draft", "active", "paused", "expired", "cancelled"]).default("draft"),
  pricingModel: z.enum(["monthly", "annual", "custom"]).default("monthly"),
  monthlyAmount: z.coerce.number().nonnegative().default(0),
  startDate: z.string().trim().optional().or(z.literal("")),
  endDate: z.string().trim().optional().or(z.literal("")),
  renewalDate: z.string().trim().optional().or(z.literal("")),
});

const platformBillSchema = z.object({
  schoolId: z.string().uuid(),
  billNumber: z.string().trim().min(2),
  description: z.string().trim().min(2),
  amount: z.coerce.number().positive(),
  dueDate: z.string().trim().min(1),
});

const platformTransactionSchema = z.object({
  billId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(["cash", "bank_transfer", "card", "upi", "cheque", "other"]).default("bank_transfer"),
  transactionDate: z.string().trim().min(1),
  notes: z.string().trim().optional().or(z.literal("")),
});

const platformBillingReconciliationSchema = z.object({
  billId: z.string().uuid().optional(),
});

const schoolTrialSchema = z.object({
  schoolId: z.string().uuid(),
  trialName: z.string().trim().min(2),
  status: z.enum(["pending", "active", "expired", "converted"]).default("pending"),
  startsOn: z.string().trim().optional().or(z.literal("")),
  endsOn: z.string().trim().min(1),
  seats: z.coerce.number().int().positive().default(25),
  notes: z.string().trim().optional().or(z.literal("")),
});

const rolePermissionSchema = z.object({
  roleId: z.string().uuid(),
  permissionId: z.string().uuid(),
});

const contractLifecycleSchema = z.object({
  contractId: z.string().uuid(),
});

const lifecycleActivationSchema = z.object({
  schoolId: z.string().uuid(),
  planName: z.string().trim().min(2).default("Starter"),
  monthlyAmount: z.coerce.number().nonnegative().default(0),
  contractNumber: z.string().trim().min(2).default("CT-LIVE"),
  trialId: z.string().uuid().optional(),
});

function getAppOrigin() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function enterSchoolWorkspace(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const schoolId = z.string().regex(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i).safeParse(formData.get("schoolId"));
  if (!user || !schoolId.success || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/admin?error=not-authorized");
  }

  const { data: school } = await supabase.from("schools").select("id").eq("id", schoolId.data).maybeSingle();
  if (!school) redirect("/admin/schools?error=school-not-found");

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SCHOOL_COOKIE, schoolId.data, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  cookieStore.set("schooliva_selected_school", schoolId.data, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  redirect("/dashboard");
}

export async function selectSchoolWorkspace(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const schoolId = z.string().regex(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i).safeParse(formData.get("schoolId"));
  if (!schoolId.success) redirect("/dashboard?error=invalid-school");

  const { data: membership } = await supabase.from("user_roles").select("school_id").eq("user_id", user.id).eq("school_id", schoolId.data).maybeSingle();
  if (!membership) redirect("/dashboard?error=not-authorized");

  const cookieStore = await cookies();
  cookieStore.set("schooliva_selected_school", schoolId.data, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  redirect("/dashboard");
}

export async function exitSchoolWorkspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) redirect("/sign-in");
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SCHOOL_COOKIE);
  redirect("/admin");
}

export async function createSchool(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/dashboard?error=not-authorized");
  }

  const parsed = schoolSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    city: formData.get("city"),
    state: formData.get("state"),
    country: formData.get("country"),
    status: formData.get("status") ?? "active",
  });

  if (!parsed.success) {
    redirect("/admin/schools?error=invalid-school");
  }

  const slug = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "school";
  const { data: newSchool, error: schoolError } = await supabase.from("schools").insert({
    name: parsed.data.name,
    slug,
    code: parsed.data.code,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null,
    city: parsed.data.city || null,
    state: parsed.data.state || null,
    country: parsed.data.country || null,
    is_active: parsed.data.status === "active",
    created_by: user.id,
  }).select("id").single();

  if (schoolError || !newSchool) {
    redirect("/admin/schools?error=school-create-failed");
  }

  const { error: settingsError } = await supabase.from("school_settings").upsert({
    school_id: newSchool.id,
    timezone: "UTC",
    currency_code: "USD",
    date_format: "YYYY-MM-DD",
    locale: "en",
  }, { onConflict: "school_id" });

  if (settingsError) {
    redirect("/admin/schools?error=school-settings-create-failed");
  }

  const { error: quotaError } = await supabase.from("school_storage_quotas").upsert({
    school_id: newSchool.id,
    quota_bytes: 1073741824,
    warning_threshold: 0.8,
    is_active: true,
  }, { onConflict: "school_id" });

  if (quotaError) {
    redirect("/admin/schools?error=school-quota-create-failed");
  }

  const currentDate = new Date().toISOString().slice(0, 10);
  const trialEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { error: trialError } = await supabase.from("school_trials").upsert({
    school_id: newSchool.id,
    trial_name: "Onboarding Trial",
    status: "pending",
    starts_on: currentDate,
    ends_on: trialEndDate,
    seats: 25,
    notes: "Initial onboarding trial created automatically for the new school.",
  }, { onConflict: "school_id,trial_name" });

  if (trialError) {
    redirect("/admin/schools?error=school-trial-create-failed");
  }

  const { error: contractError } = await supabase.from("platform_contracts").upsert({
    school_id: newSchool.id,
    contract_number: `CT-${Date.now()}`,
    plan_name: "Starter",
    pricing_model: "monthly",
    monthly_amount: 0,
    status: "draft",
    start_date: currentDate,
    end_date: null,
    renewal_date: null,
    metadata: { source: "school_onboarding", created_by: user.id },
  }, { onConflict: "school_id,contract_number" });

  if (contractError) {
    redirect("/admin/schools?error=school-contract-create-failed");
  }

  const { data: schoolAdminRole, error: schoolAdminRoleError } = await supabase
    .from("roles")
    .select("id")
    .eq("school_id", null)
    .eq("slug", "school_admin")
    .maybeSingle();

  if (schoolAdminRoleError || !schoolAdminRole) {
    redirect("/admin/schools?error=school-admin-role-missing");
  }

  const { error: membershipError } = await supabase.from("user_roles").upsert({
    user_id: user.id,
    school_id: newSchool.id,
    role_id: schoolAdminRole.id,
  }, { onConflict: "user_id,school_id,role_id" });

  if (membershipError) {
    redirect("/admin/schools?error=school-admin-membership-failed");
  }

  const { error: brandingError } = await supabase.from("school_branding").upsert({
    school_id: newSchool.id,
    primary_color: "#2563eb",
    secondary_color: "#0f172a",
    accent_color: "#f59e0b",
    background_color: "#f8fafc",
    foreground_color: "#0f172a",
    card_color: "#ffffff",
    muted_color: "#64748b",
    border_color: "#dfe7ee",
    success_color: "#16a34a",
    warning_color: "#f59e0b",
    destructive_color: "#dc2626",
    info_color: "#2563eb",
    theme_mode: "light",
  }, { onConflict: "school_id" });

  if (brandingError) {
    redirect("/admin/schools?error=school-branding-create-failed");
  }

  await recordAuditEvent(supabase, {
    schoolId: newSchool.id,
    action: "create",
    entityType: "schools",
    entityId: newSchool.id,
    metadata: { created_by: user.id, source: "school_onboarding" },
    actorId: user.id,
  });

  redirect("/admin/schools");
}

export async function createSchoolUser(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/dashboard?error=not-authorized");
  }

  const parsed = schoolUserSchema.safeParse({
    schoolId: formData.get("schoolId"),
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
    roleSlug: formData.get("roleSlug"),
  });

  if (!parsed.success) {
    redirect("/admin/schools/" + (String(formData.get("schoolId") ?? "") || "") + "?error=invalid-user");
  }

  const isMaster = await isMasterAdminUser(supabase, user.id);
  const { data: allSchools } = await supabase.from("schools").select("id");
  const { data: memberships } = await supabase.from("user_roles").select("school_id").eq("user_id", user.id);
  const authorizedSchoolId = resolveAuthorizedSchoolId({
    candidateSchoolId: parsed.data.schoolId,
    availableSchoolIds: isMaster ? (allSchools ?? []).map((school) => school.id) : (memberships ?? []).map((membership) => membership.school_id),
    isMasterAdmin: isMaster,
  });

  if (!authorizedSchoolId) {
    redirect("/dashboard?error=not-authorized");
  }

  const { data: school } = await supabase.from("schools").select("id").eq("id", authorizedSchoolId).maybeSingle();
  if (!school) {
    redirect("/admin/schools?error=school-not-found");
  }

  const { data: role } = await supabase.from("roles").select("id").eq("slug", parsed.data.roleSlug).maybeSingle();
  if (!role) {
    redirect("/admin/schools/" + parsed.data.schoolId + "?error=role-not-found");
  }

  const { data: authUser, error: authError } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        username: parsed.data.username,
      },
      emailRedirectTo: getAppOrigin() + "/sign-in",
    },
  });

  if (authError || !authUser.user) {
    redirect("/admin/schools/" + parsed.data.schoolId + "?error=user-create-failed");
  }

  const { error: membershipError } = await supabase.from("user_roles").insert({
    user_id: authUser.user.id,
    school_id: authorizedSchoolId,
    role_id: role.id,
  });

  if (membershipError) {
    redirect("/admin/schools/" + parsed.data.schoolId + "?error=membership-create-failed");
  }

  await recordAuditEvent(supabase, {
    schoolId: authorizedSchoolId,
    action: "create",
    entityType: "user_roles",
    entityId: role.id,
    metadata: { created_user_id: authUser.user.id, role_slug: parsed.data.roleSlug, source: "school_admin" },
    actorId: user.id,
  });

  redirect("/admin/schools/" + authorizedSchoolId + "?success=user-created");
}

export async function resetSchoolUserPassword(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/dashboard?error=not-authorized");
  }

  const parsed = resetPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    redirect("/admin/schools?error=invalid-email");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: getAppOrigin() + "/reset-password",
  });

  if (error) {
    redirect("/admin/schools?error=password-reset-failed");
  }

  redirect("/admin/schools?success=password-reset-sent");
}

export async function toggleSchoolUserStatus(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/dashboard?error=not-authorized");
  }

  const parsed = toggleAccountSchema.safeParse({
    userId: formData.get("userId"),
    schoolId: formData.get("schoolId"),
    enabled: formData.get("enabled"),
  });

  if (!parsed.success) {
    redirect("/admin/schools?error=invalid-status");
  }

  const { error } = await supabase.from("profiles").update({ is_active: parsed.data.enabled === "true" }).eq("id", parsed.data.userId);
  if (error) {
    redirect("/admin/schools?error=status-update-failed");
  }

  redirect(parsed.data.schoolId ? "/admin/schools/" + parsed.data.schoolId : "/admin/schools");
}

export async function saveSchoolBranding(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/dashboard?error=not-authorized");
  }

  const parsed = schoolBrandingSchema.safeParse({
    schoolId: formData.get("schoolId"),
    primaryColor: formData.get("primaryColor") ?? "#2563eb",
    secondaryColor: formData.get("secondaryColor") ?? "#0f172a",
    accentColor: formData.get("accentColor") ?? "#f59e0b",
    backgroundColor: formData.get("backgroundColor") ?? "#f8fafc",
    foregroundColor: formData.get("foregroundColor") ?? "#0f172a",
    cardColor: formData.get("cardColor") ?? "#ffffff",
    mutedColor: formData.get("mutedColor") ?? "#64748b",
    borderColor: formData.get("borderColor") ?? "#dfe7ee",
    successColor: formData.get("successColor") ?? "#16a34a",
    warningColor: formData.get("warningColor") ?? "#f59e0b",
    destructiveColor: formData.get("destructiveColor") ?? "#dc2626",
    infoColor: formData.get("infoColor") ?? "#2563eb",
    themeMode: formData.get("themeMode") ?? "light",
  });

  if (!parsed.success) {
    redirect("/admin/schools?error=invalid-branding");
  }

  const isMaster = true;
  const { data: allSchools } = await supabase.from("schools").select("id");
  const authorizedSchoolId = resolveAuthorizedSchoolId({
    candidateSchoolId: parsed.data.schoolId,
    availableSchoolIds: (allSchools ?? []).map((school) => school.id),
    isMasterAdmin: isMaster,
  });

  if (!authorizedSchoolId) {
    redirect("/dashboard?error=not-authorized");
  }

  const existingBranding = await supabase.from("school_branding").select("logo_path").eq("school_id", authorizedSchoolId).maybeSingle();
  if (existingBranding.error) {
    redirect("/admin/schools/" + authorizedSchoolId + "?error=branding-load-failed");
  }
  const uploadedFile = formData.get("schoolLogo");
  let logoPath = existingBranding.data?.logo_path ?? null;
  let uploadedLogoPath: string | null = null;

  if (uploadedFile instanceof File && uploadedFile.size > 0) {
    const allowedMimeTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowedMimeTypes.includes(uploadedFile.type) && !uploadedFile.name.toLowerCase().endsWith(".svg")) {
      redirect("/admin/schools/" + authorizedSchoolId + "?error=invalid-logo-type");
    }

    if (uploadedFile.size > 5 * 1024 * 1024) {
      redirect("/admin/schools/" + authorizedSchoolId + "?error=logo-too-large");
    }

    const extension = uploadedFile.name.includes(".") ? uploadedFile.name.split(".").pop() ?? "png" : "png";
    const storagePath = `${authorizedSchoolId}/logo-${crypto.randomUUID()}.${extension.toLowerCase()}`;
    const { error: uploadError } = await supabase.storage.from("school-branding").upload(storagePath, uploadedFile, {
      upsert: true,
      contentType: uploadedFile.type || "image/png",
    });

    if (uploadError) {
      redirect("/admin/schools/" + authorizedSchoolId + "?error=logo-upload-failed");
    }

    logoPath = storagePath;
    uploadedLogoPath = storagePath;
  }

  const values = {
    school_id: authorizedSchoolId,
    logo_path: logoPath,
    primary_color: sanitizeColor(parsed.data.primaryColor) ?? "#2563eb",
    secondary_color: sanitizeColor(parsed.data.secondaryColor) ?? "#0f172a",
    accent_color: sanitizeColor(parsed.data.accentColor) ?? "#f59e0b",
    background_color: sanitizeColor(parsed.data.backgroundColor) ?? "#f8fafc",
    foreground_color: sanitizeColor(parsed.data.foregroundColor) ?? "#0f172a",
    card_color: sanitizeColor(parsed.data.cardColor) ?? "#ffffff",
    muted_color: sanitizeColor(parsed.data.mutedColor) ?? "#64748b",
    border_color: sanitizeColor(parsed.data.borderColor) ?? "#dfe7ee",
    success_color: sanitizeColor(parsed.data.successColor) ?? "#16a34a",
    warning_color: sanitizeColor(parsed.data.warningColor) ?? "#f59e0b",
    destructive_color: sanitizeColor(parsed.data.destructiveColor) ?? "#dc2626",
    info_color: sanitizeColor(parsed.data.infoColor) ?? "#2563eb",
    theme_mode: parsed.data.themeMode,
  };

  const { error } = await supabase.from("school_branding").upsert({ ...values }, { onConflict: "school_id" });
  if (error) {
    if (uploadedLogoPath) {
      const { error: cleanupError } = await supabase.storage.from("school-branding").remove([uploadedLogoPath]);
      if (cleanupError) {
        redirect("/admin/schools/" + authorizedSchoolId + "?error=branding-save-and-logo-cleanup-failed");
      }
    }
    redirect("/admin/schools?error=branding-save-failed");
  }

  if (existingBranding.data?.logo_path && existingBranding.data.logo_path !== logoPath) {
    const { error: removeError } = await supabase.storage.from("school-branding").remove([existingBranding.data.logo_path]);
    if (removeError) {
      redirect("/admin/schools/" + authorizedSchoolId + "?success=branding-saved&warning=old-logo-cleanup-failed");
    }
  }

  redirect("/admin/schools/" + authorizedSchoolId + "?success=branding-saved");
}

export async function createPlatformContract(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/dashboard?error=not-authorized");
  }

  const parsed = platformContractSchema.safeParse({
    schoolId: formData.get("schoolId"),
    contractNumber: formData.get("contractNumber"),
    planName: formData.get("planName"),
    status: formData.get("status") ?? "draft",
    pricingModel: formData.get("pricingModel") ?? "monthly",
    monthlyAmount: formData.get("monthlyAmount") ?? "0",
    startDate: formData.get("startDate") ?? "",
    endDate: formData.get("endDate") ?? "",
    renewalDate: formData.get("renewalDate") ?? "",
  });

  if (!parsed.success) {
    redirect("/admin/contracts?error=invalid-contract");
  }

  const { data: allSchools } = await supabase.from("schools").select("id");
  const authorizedSchoolId = resolveAuthorizedSchoolId({
    candidateSchoolId: parsed.data.schoolId,
    availableSchoolIds: (allSchools ?? []).map((school) => school.id),
    isMasterAdmin: true,
  });

  if (!authorizedSchoolId) {
    redirect("/dashboard?error=not-authorized");
  }

  const { error } = await supabase.from("platform_contracts").insert({
    school_id: authorizedSchoolId,
    contract_number: parsed.data.contractNumber,
    plan_name: parsed.data.planName,
    pricing_model: parsed.data.pricingModel,
    monthly_amount: parsed.data.monthlyAmount,
    status: parsed.data.status,
    start_date: parsed.data.startDate || new Date().toISOString().slice(0, 10),
    end_date: parsed.data.endDate || null,
    renewal_date: parsed.data.renewalDate || null,
    metadata: { created_by: user.id },
  });

  if (error) {
    redirect("/admin/contracts?error=contract-create-failed");
  }

  await recordAuditEvent(supabase, {
    schoolId: authorizedSchoolId,
    action: "create",
    entityType: "platform_contracts",
    entityId: undefined,
    metadata: { contract_number: parsed.data.contractNumber, plan_name: parsed.data.planName, monthly_amount: parsed.data.monthlyAmount },
    actorId: user.id,
  });

  redirect("/admin/contracts?success=contract-created");
}

export async function createPlatformBill(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/dashboard?error=not-authorized");
  }

  const parsed = platformBillSchema.safeParse({
    schoolId: formData.get("schoolId"),
    billNumber: formData.get("billNumber"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    dueDate: formData.get("dueDate"),
  });
  if (!parsed.success) redirect("/admin/billing?error=invalid-bill");

  const { data: allSchools } = await supabase.from("schools").select("id");
  const schoolId = resolveAuthorizedSchoolId({
    candidateSchoolId: parsed.data.schoolId,
    availableSchoolIds: (allSchools ?? []).map((school) => school.id),
    isMasterAdmin: true,
  });
  if (!schoolId) redirect("/admin/billing?error=school-not-found");

  const { data: bill, error } = await supabase.from("platform_bills").insert({
    school_id: schoolId,
    bill_number: parsed.data.billNumber,
    description: parsed.data.description,
    total_amount: parsed.data.amount,
    due_date: parsed.data.dueDate,
    created_by: user.id,
  }).select("id").single();
  if (error || !bill) redirect("/admin/billing?error=bill-create-failed");

  await recordAuditEvent(supabase, {
    schoolId,
    action: "create",
    entityType: "platform_bills",
    entityId: bill.id,
    metadata: { bill_number: parsed.data.billNumber, amount: parsed.data.amount },
    actorId: user.id,
  });
  redirect("/admin/billing?success=bill-created");
}

export async function createSchoolTrial(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/dashboard?error=not-authorized");
  }

  const parsed = schoolTrialSchema.safeParse({
    schoolId: formData.get("schoolId"),
    trialName: formData.get("trialName"),
    status: formData.get("status") ?? "pending",
    startsOn: formData.get("startsOn") ?? "",
    endsOn: formData.get("endsOn"),
    seats: formData.get("seats") ?? "25",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    redirect("/admin/trials?error=invalid-trial");
  }

  const { data: allSchools } = await supabase.from("schools").select("id");
  const authorizedSchoolId = resolveAuthorizedSchoolId({
    candidateSchoolId: parsed.data.schoolId,
    availableSchoolIds: (allSchools ?? []).map((school) => school.id),
    isMasterAdmin: true,
  });

  if (!authorizedSchoolId) {
    redirect("/dashboard?error=not-authorized");
  }

  const { error } = await supabase.from("school_trials").insert({
    school_id: authorizedSchoolId,
    trial_name: parsed.data.trialName,
    status: parsed.data.status,
    starts_on: parsed.data.startsOn || new Date().toISOString().slice(0, 10),
    ends_on: parsed.data.endsOn,
    seats: parsed.data.seats,
    notes: parsed.data.notes || null,
  });

  if (error) {
    redirect("/admin/trials?error=trial-create-failed");
  }

  await recordAuditEvent(supabase, {
    schoolId: authorizedSchoolId,
    action: "create",
    entityType: "school_trials",
    entityId: undefined,
    metadata: { trial_name: parsed.data.trialName, starts_on: parsed.data.startsOn, ends_on: parsed.data.endsOn, seats: parsed.data.seats },
    actorId: user.id,
  });

  redirect("/admin/trials?success=trial-created");
}

export async function recordPlatformTransaction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/dashboard?error=not-authorized");
  }

  const parsed = platformTransactionSchema.safeParse({
    billId: formData.get("billId"),
    amount: formData.get("amount"),
    paymentMethod: formData.get("paymentMethod") ?? "bank_transfer",
    transactionDate: formData.get("transactionDate") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) redirect("/admin/payments?error=invalid-payment");

  const { data: bill, error: billError } = await supabase.from("platform_bills")
    .select("id,school_id,bill_number,total_amount,paid_amount")
    .eq("id", parsed.data.billId)
    .maybeSingle();
  if (billError || !bill) redirect("/admin/payments?error=bill-not-found");
  if (Number(parsed.data.amount) > Number(bill.total_amount) - Number(bill.paid_amount ?? 0)) {
    redirect("/admin/payments?error=payment-exceeds-balance");
  }

  const transactionReference = `PT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const { data: transaction, error } = await supabase.from("platform_transactions").insert({
    school_id: bill.school_id,
    bill_id: bill.id,
    transaction_reference: transactionReference,
    amount: parsed.data.amount,
    payment_method: parsed.data.paymentMethod,
    transaction_date: parsed.data.transactionDate,
    notes: parsed.data.notes || null,
    created_by: user.id,
  }).select("id").single();
  if (error || !transaction) redirect("/admin/payments?error=payment-create-failed");

  await recordAuditEvent(supabase, {
    schoolId: bill.school_id,
    action: "create",
    entityType: "platform_transactions",
    entityId: transaction.id,
    metadata: { transaction_reference: transactionReference, bill_number: bill.bill_number, amount: parsed.data.amount },
    actorId: user.id,
  });
  redirect("/admin/payments?success=payment-recorded");
}

export async function activateSchoolLifecycle(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/dashboard?error=not-authorized");
  }

  const parsed = lifecycleActivationSchema.safeParse({
    schoolId: formData.get("schoolId"),
    planName: formData.get("planName") ?? "Starter",
    monthlyAmount: formData.get("monthlyAmount") ?? "0",
    contractNumber: formData.get("contractNumber") ?? `CT-${Date.now()}`,
    trialId: formData.get("trialId") ?? undefined,
  });

  if (!parsed.success) {
    redirect("/admin/schools?error=invalid-lifecycle-activation");
  }

  const isMaster = await isMasterAdminUser(supabase, user.id);
  const { data: allSchools } = await supabase.from("schools").select("id");
  const { data: memberships } = await supabase.from("user_roles").select("school_id").eq("user_id", user.id);
  const authorizedSchoolId = resolveAuthorizedSchoolId({
    candidateSchoolId: parsed.data.schoolId,
    availableSchoolIds: isMaster ? (allSchools ?? []).map((school) => school.id) : (memberships ?? []).map((membership) => membership.school_id),
    isMasterAdmin: isMaster,
  });

  if (!authorizedSchoolId) {
    redirect("/dashboard?error=not-authorized");
  }

  const { data: school } = await supabase.from("schools").select("id").eq("id", authorizedSchoolId).maybeSingle();
  if (!school) {
    redirect("/admin/schools?error=school-not-found");
  }

  const { error: schoolStatusError } = await supabase.from("schools").update({ is_active: true }).eq("id", authorizedSchoolId);
  if (schoolStatusError) {
    redirect("/admin/schools?error=school-activation-failed");
  }

  const currentDate = new Date().toISOString().slice(0, 10);
  const { data: contract } = await supabase.from("platform_contracts").upsert({
    school_id: authorizedSchoolId,
    contract_number: parsed.data.contractNumber,
    plan_name: parsed.data.planName,
    pricing_model: "monthly",
    monthly_amount: parsed.data.monthlyAmount,
    status: "active",
    start_date: currentDate,
    end_date: null,
    renewal_date: null,
    metadata: { source: "manual_activation", created_by: user.id },
  }, { onConflict: "school_id,contract_number" }).select("id").maybeSingle();

  if (!contract) {
    redirect("/admin/schools/" + authorizedSchoolId + "?error=contract-activation-failed");
  }

  if (parsed.data.trialId) {
    const { error: trialError } = await supabase.from("school_trials").update({
      status: "converted",
      notes: "Converted to a live contract by the master admin.",
    }).eq("id", parsed.data.trialId).eq("school_id", authorizedSchoolId);

    if (trialError) {
      redirect("/admin/schools/" + authorizedSchoolId + "?error=trial-conversion-failed");
    }
  }

  redirect("/admin/schools/" + authorizedSchoolId + "?success=lifecycle-activated");
}

export async function pauseSchoolContract(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/dashboard?error=not-authorized");
  }

  const parsed = contractLifecycleSchema.safeParse({ contractId: formData.get("contractId") });
  if (!parsed.success) {
    redirect("/admin/contracts?error=invalid-contract-action");
  }

  const { error } = await supabase.from("platform_contracts").update({
    status: "paused",
    renewal_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    metadata: { status_changed_by: user.id, change: "paused" },
  }).eq("id", parsed.data.contractId);

  if (error) {
    redirect("/admin/contracts?error=contract-pause-failed");
  }

  redirect("/admin/contracts?success=contract-paused");
}

export async function cancelSchoolContract(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/dashboard?error=not-authorized");
  }

  const parsed = contractLifecycleSchema.safeParse({ contractId: formData.get("contractId") });
  if (!parsed.success) {
    redirect("/admin/contracts?error=invalid-contract-action");
  }

  const { error } = await supabase.from("platform_contracts").update({
    status: "cancelled",
    end_date: new Date().toISOString().slice(0, 10),
    metadata: { status_changed_by: user.id, change: "cancelled" },
  }).eq("id", parsed.data.contractId);

  if (error) {
    redirect("/admin/contracts?error=contract-cancel-failed");
  }

  redirect("/admin/contracts?success=contract-cancelled");
}

export async function renewSchoolContract(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/dashboard?error=not-authorized");
  }

  const parsed = contractLifecycleSchema.safeParse({ contractId: formData.get("contractId") });
  if (!parsed.success) {
    redirect("/admin/contracts?error=invalid-contract-action");
  }

  const requestedRenewalDate = String(formData.get("renewalDate") ?? "").trim();
  const today = new Date().toISOString().slice(0, 10);
  const fallbackRenewalDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const renewalDate = requestedRenewalDate || fallbackRenewalDate;
  const renewalWindow = resolveContractRenewalWindow({
    status: "active",
    renewalDate,
    asOf: today,
  });

  const { error } = await supabase.from("platform_contracts").update({
    status: "active",
    start_date: today,
    renewal_date: renewalDate,
    end_date: renewalWindow.isRenewalDue || renewalWindow.warns ? null : null,
    metadata: {
      status_changed_by: user.id,
      change: "renewed",
      renewal_window: renewalWindow,
      renewal_date: renewalDate,
    },
  }).eq("id", parsed.data.contractId);

  if (error) {
    redirect("/admin/contracts?error=contract-renewal-failed");
  }

  redirect("/admin/contracts?success=contract-renewed");
}

export async function reconcilePlatformBills(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/dashboard?error=not-authorized");
  }

  const parsed = platformBillingReconciliationSchema.safeParse({ billId: formData.get("billId") ?? undefined });
  if (!parsed.success) redirect("/admin/billing?error=invalid-reconciliation");

  let query = supabase.from("platform_bills").select("id,total_amount,paid_amount,due_date");
  if (parsed.data.billId) query = query.eq("id", parsed.data.billId);
  const { data: bills, error } = await query;
  if (error || !bills) redirect("/admin/billing?error=reconciliation-failed");

  for (const bill of bills) {
    const nextState = reconcileInvoiceStatus({
      total: Number(bill.total_amount ?? 0),
      paidAmount: Number(bill.paid_amount ?? 0),
      dueDate: String(bill.due_date ?? ""),
    });
    const { error: updateError } = await supabase.from("platform_bills")
      .update({ status: nextState.status })
      .eq("id", bill.id);
    if (updateError) redirect("/admin/billing?error=reconciliation-update-failed");
  }

  redirect("/admin/billing?success=bills-reconciled");
}

export async function assignPermissionToRole(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/dashboard?error=not-authorized");
  }

  const parsed = rolePermissionSchema.safeParse({
    roleId: formData.get("roleId"),
    permissionId: formData.get("permissionId"),
  });

  if (!parsed.success) {
    redirect("/admin/roles?error=invalid-role-permission");
  }

  const { data: role } = await supabase.from("roles").select("id").eq("id", parsed.data.roleId).maybeSingle();
  const { data: permission } = await supabase.from("permissions").select("id").eq("id", parsed.data.permissionId).maybeSingle();

  if (!role || !permission) {
    redirect("/admin/roles?error=role-permission-not-found");
  }

  const { error } = await supabase.from("role_permissions").upsert({
    role_id: parsed.data.roleId,
    permission_id: parsed.data.permissionId,
  }, { onConflict: "role_id,permission_id" });

  if (error) {
    redirect("/admin/roles?error=permission-assignment-failed");
  }

  redirect("/admin/roles?success=permission-assigned");
}

export async function removePermissionFromRole(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/dashboard?error=not-authorized");
  }

  const parsed = rolePermissionSchema.safeParse({
    roleId: formData.get("roleId"),
    permissionId: formData.get("permissionId"),
  });

  if (!parsed.success) {
    redirect("/admin/roles?error=invalid-role-permission");
  }

  const { error } = await supabase.from("role_permissions").delete().eq("role_id", parsed.data.roleId).eq("permission_id", parsed.data.permissionId);
  if (error) {
    redirect("/admin/roles?error=permission-removal-failed");
  }

  redirect("/admin/roles?success=permission-removed");
}
