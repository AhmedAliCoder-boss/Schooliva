"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";

import { ADMIN_SCHOOL_COOKIE } from "@/lib/admin/school-context";
import { isMasterAdminUser } from "@/lib/auth/roles";
import { resolveAuthorizedSchoolId } from "@/lib/auth/school-access";
import { reconcileInvoiceStatus } from "@/lib/billing-reconciliation";
import { addDaysToDate, getBillingPeriodEnd, getPlatformInvoiceAmount, type PlatformBillingModel } from "@/lib/platform-billing";
import { recordAuditEvent } from "@/lib/audit/logging";
import { sanitizeColor } from "@/lib/school-branding";
import { createClient } from "@/lib/supabase/server";

const schoolSchema = z.object({
  name: z.string().trim().min(2),
  code: z.string().trim().min(2),
  trialDays: z.coerce.number().int().min(1).max(90).default(30),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  state: z.string().trim().optional().or(z.literal("")),
  country: z.string().trim().optional().or(z.literal("")),
});

const postgresUuidSchema = z.string().trim().regex(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);

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
  schoolId: postgresUuidSchema,
  contractNumber: z.string().trim().min(2).or(z.literal("")).default(""),
  planName: z.string().trim().min(2),
  status: z.enum(["draft", "active", "paused", "expired", "cancelled"]).default("draft"),
  pricingModel: z.enum(["monthly", "annual", "custom"]).default("monthly"),
  monthlyAmount: z.coerce.number().positive(),
  startDate: z.string().trim().optional().or(z.literal("")),
  endDate: z.string().trim().optional().or(z.literal("")),
});

const platformBillSchema = z.object({
  schoolId: z.string().trim().min(1),
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
  schoolId: postgresUuidSchema,
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
  contractId: postgresUuidSchema,
});

const trialLifecycleSchema = z.object({
  trialId: postgresUuidSchema,
  status: z.enum(["pending", "active", "expired"]),
  endsOn: z.string().trim().min(1),
  seats: z.coerce.number().int().positive(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

const lifecycleActivationSchema = z.object({
  schoolId: postgresUuidSchema,
  planName: z.string().trim().min(2).default("Starter"),
  pricingModel: z.enum(["monthly", "annual", "custom"]).default("monthly"),
  monthlyAmount: z.coerce.number().positive(),
  contractNumber: z.string().trim().min(2).optional().or(z.literal("")),
  endDate: z.string().trim().optional().or(z.literal("")),
  trialId: postgresUuidSchema.optional(),
});

async function createContractInvoice({
  supabase,
  contractId,
  schoolId,
  planName,
  pricingModel,
  monthlyAmount,
  startDate,
  endDate,
  dueDate,
  createdBy,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  contractId: string;
  schoolId: string;
  planName: string;
  pricingModel: PlatformBillingModel;
  monthlyAmount: number;
  startDate: string;
  endDate?: string | null;
  dueDate?: string;
  createdBy: string;
}) {
  let periodEnd: string;
  try {
    periodEnd = getBillingPeriodEnd(startDate, pricingModel, endDate);
  } catch (error) {
    console.error("Contract billing period is invalid.", error);
    return false;
  }
  const existing = await supabase.from("platform_bills")
    .select("id")
    .eq("contract_id", contractId)
    .eq("billing_period_start", startDate)
    .maybeSingle();
  if (existing.error) return false;
  if (existing.data) return true;

  const billNumber = `PLT-${startDate.replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const { error } = await supabase.from("platform_bills").insert({
    school_id: schoolId,
    contract_id: contractId,
    bill_number: billNumber,
    description: `${planName} subscription (${startDate} to ${periodEnd})`,
    total_amount: getPlatformInvoiceAmount(pricingModel, monthlyAmount),
    due_date: dueDate ?? addDaysToDate(startDate, 7),
    created_by: createdBy,
    billing_period_start: startDate,
    billing_period_end: periodEnd,
  });
  if (!error) return true;
  if (error.code === "23505") {
    const { data: matchingBill, error: lookupError } = await supabase.from("platform_bills")
      .select("id")
      .eq("contract_id", contractId)
      .eq("billing_period_start", startDate)
      .maybeSingle();
    return Boolean(matchingBill && !lookupError);
  }
  console.error("Initial platform contract invoice could not be created.", error);
  return false;
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
  const { data: subscriptionAccess, error: accessError } = await supabase.rpc("school_subscription_access_active", {
    target_school_id: schoolId.data,
  });
  if (accessError) {
    console.error("School subscription access could not be verified.", accessError);
    redirect("/dashboard?error=school-access-unavailable");
  }
  if (subscriptionAccess !== true) redirect("/dashboard?error=school-subscription-inactive");

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
    trialDays: formData.get("trialDays") ?? "30",
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    city: formData.get("city"),
    state: formData.get("state"),
    country: formData.get("country"),
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
    is_active: true,
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
  const trialEndDate = addDaysToDate(currentDate, parsed.data.trialDays - 1);

  const { error: trialError } = await supabase.from("school_trials").upsert({
    school_id: newSchool.id,
    trial_name: "Onboarding Trial",
    status: "active",
    starts_on: currentDate,
    ends_on: trialEndDate,
    seats: 25,
    notes: "Initial onboarding trial created automatically for the new school.",
  }, { onConflict: "school_id,trial_name" });

  if (trialError) {
    redirect("/admin/schools?error=school-trial-create-failed");
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
    contractNumber: formData.get("contractNumber") ?? "",
    planName: formData.get("planName"),
    status: formData.get("status") ?? "draft",
    pricingModel: formData.get("pricingModel") ?? "monthly",
    monthlyAmount: formData.get("monthlyAmount") ?? "0",
    startDate: formData.get("startDate") ?? "",
    endDate: formData.get("endDate") ?? "",
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

  const startDate = parsed.data.startDate || new Date().toISOString().slice(0, 10);
  if (startDate > new Date().toISOString().slice(0, 10)) {
    redirect("/admin/contracts?error=invalid-contract");
  }
  try {
    getBillingPeriodEnd(startDate, parsed.data.pricingModel, parsed.data.endDate || null);
  } catch {
    redirect("/admin/contracts?error=invalid-contract");
  }
  if (parsed.data.pricingModel === "custom" && !parsed.data.endDate) {
    redirect("/admin/contracts?error=invalid-contract");
  }
  if (parsed.data.endDate && parsed.data.endDate < startDate) redirect("/admin/contracts?error=invalid-contract");
  const { data: relatedTrial, error: trialLookupError } = await supabase.from("school_trials")
    .select("id")
    .eq("school_id", authorizedSchoolId)
    .in("status", ["active", "pending"])
    .gte("ends_on", startDate)
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (trialLookupError) {
    console.error("Contract trial could not be loaded.", trialLookupError);
    redirect("/admin/contracts?error=contract-create-failed");
  }

  const { data: contract, error } = await supabase.from("platform_contracts").insert({
    school_id: authorizedSchoolId,
    contract_number: parsed.data.contractNumber,
    plan_name: parsed.data.planName,
    pricing_model: parsed.data.pricingModel,
    monthly_amount: parsed.data.monthlyAmount,
    status: "draft",
    start_date: startDate,
    end_date: parsed.data.endDate || null,
    renewal_date: null,
    metadata: { created_by: user.id, ...(relatedTrial ? { trial_id: relatedTrial.id } : {}) },
  }).select("id,contract_number").single();

  if (error || !contract) {
    console.error("Platform contract could not be created.", error);
    redirect("/admin/contracts?error=contract-create-failed");
  }

  const invoiceCreated = await createContractInvoice({
    supabase,
    contractId: contract.id,
    schoolId: authorizedSchoolId,
    planName: parsed.data.planName,
    pricingModel: parsed.data.pricingModel,
    monthlyAmount: parsed.data.monthlyAmount,
    startDate,
    endDate: parsed.data.endDate || null,
    createdBy: user.id,
  });
  if (!invoiceCreated) redirect("/admin/contracts?error=contract-invoice-create-failed");

  await recordAuditEvent(supabase, {
    schoolId: authorizedSchoolId,
    action: "create",
    entityType: "platform_contracts",
    entityId: contract.id,
    metadata: { contract_number: contract.contract_number, plan_name: parsed.data.planName, monthly_amount: parsed.data.monthlyAmount, pricing_model: parsed.data.pricingModel, status: "draft", initial_invoice_scheduled: true },
    actorId: user.id,
  });

  redirect("/admin/contracts?success=contract-invoice-scheduled");
}

export async function createPlatformBill(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/dashboard?error=not-authorized");
  }

  const parsed = platformBillSchema.safeParse({
    schoolId: formData.get("schoolId"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    dueDate: formData.get("dueDate"),
  });
  if (!parsed.success) {
    const hasInvalidSchoolId = parsed.error.issues.some((issue) => issue.path[0] === "schoolId");
    redirect(hasInvalidSchoolId ? "/admin/billing?error=invalid-school" : "/admin/billing?error=invalid-bill");
  }

  const { data: allSchools, error: schoolsError } = await supabase.from("schools").select("id");
  if (schoolsError) redirect("/admin/billing?error=school-lookup-failed");
  const availableSchoolIds = (allSchools ?? []).map((school) => school.id);
  if (!availableSchoolIds.length) redirect("/admin/billing?error=school-not-found");
  const schoolId = resolveAuthorizedSchoolId({
    candidateSchoolId: parsed.data.schoolId,
    availableSchoolIds,
    isMasterAdmin: true,
  });
  if (!schoolId) redirect("/admin/billing?error=school-not-found");

  const billNumber = `PLT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").toUpperCase()}`;
  const { data: bill, error } = await supabase.from("platform_bills").insert({
    school_id: schoolId,
    bill_number: billNumber,
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
    metadata: { bill_number: billNumber, amount: parsed.data.amount },
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

  if (parsed.data.status === "active") {
    const { error: activationError } = await supabase.from("schools")
      .update({ is_active: true })
      .eq("id", authorizedSchoolId);
    if (activationError) {
      console.error("School could not be enabled for its new trial.", activationError);
      redirect("/admin/trials?error=trial-create-failed");
    }
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
  if (parsed.data.transactionDate > new Date().toISOString().slice(0, 10)) {
    redirect("/admin/payments?error=invalid-payment");
  }

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
    pricingModel: formData.get("pricingModel") ?? "monthly",
    contractNumber: formData.get("contractNumber") ?? "",
    endDate: formData.get("endDate") ?? "",
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

  const { data: school, error: schoolLookupError } = await supabase.from("schools")
    .select("id")
    .eq("id", authorizedSchoolId)
    .maybeSingle();
  if (schoolLookupError) {
    console.error("School could not be loaded for contract setup.", schoolLookupError);
    redirect("/admin/schools?error=school-not-found");
  }
  if (!school) {
    redirect("/admin/schools?error=school-not-found");
  }

  const currentDate = new Date().toISOString().slice(0, 10);
  try {
    getBillingPeriodEnd(currentDate, parsed.data.pricingModel, parsed.data.endDate || null);
  } catch {
    redirect("/admin/schools/" + authorizedSchoolId + "?error=invalid-lifecycle-activation");
  }
  if (parsed.data.pricingModel === "custom" && !parsed.data.endDate) {
    redirect("/admin/schools/" + authorizedSchoolId + "?error=invalid-lifecycle-activation");
  }
  const { data: contract, error: contractError } = await supabase.from("platform_contracts").insert({
    school_id: authorizedSchoolId,
    contract_number: parsed.data.contractNumber || "",
    plan_name: parsed.data.planName,
    pricing_model: parsed.data.pricingModel,
    monthly_amount: parsed.data.monthlyAmount,
    status: "draft",
    start_date: currentDate,
    end_date: parsed.data.endDate || null,
    renewal_date: null,
    metadata: { source: "contract_setup", created_by: user.id, ...(parsed.data.trialId ? { trial_id: parsed.data.trialId } : {}) },
  }).select("id,contract_number").single();

  if (contractError || !contract) {
    console.error("Paid school contract could not be created.", contractError);
    redirect("/admin/schools/" + authorizedSchoolId + "?error=contract-activation-failed");
  }

  const invoiceCreated = await createContractInvoice({
    supabase,
    contractId: contract.id,
    schoolId: authorizedSchoolId,
    planName: parsed.data.planName,
    pricingModel: parsed.data.pricingModel,
    monthlyAmount: parsed.data.monthlyAmount,
    startDate: currentDate,
    endDate: parsed.data.endDate || null,
    createdBy: user.id,
  });
  if (!invoiceCreated) {
    redirect("/admin/schools/" + authorizedSchoolId + "?error=contract-invoice-create-failed");
  }

  await recordAuditEvent(supabase, {
    schoolId: authorizedSchoolId,
    action: "create",
    entityType: "platform_contracts",
    entityId: contract.id,
    metadata: { contract_number: contract.contract_number, plan_name: parsed.data.planName, pricing_model: parsed.data.pricingModel, monthly_amount: parsed.data.monthlyAmount, status: "draft", initial_invoice_scheduled: true },
    actorId: user.id,
  });

  redirect("/admin/schools/" + authorizedSchoolId + "?success=contract-invoice-scheduled");
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

  const { data: contract, error } = await supabase.from("platform_contracts").update({
    status: "paused",
  }).eq("id", parsed.data.contractId).select("id,school_id,contract_number").maybeSingle();

  if (error || !contract) {
    console.error("Contract could not be paused.", error);
    redirect("/admin/contracts?error=contract-pause-failed");
  }

  await recordAuditEvent(supabase, {
    schoolId: contract.school_id,
    action: "update",
    entityType: "platform_contracts",
    entityId: contract.id,
    metadata: { contract_number: contract.contract_number, status: "paused" },
    actorId: user.id,
  });
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

  const { data: contract, error } = await supabase.from("platform_contracts").update({
    status: "cancelled",
  }).eq("id", parsed.data.contractId).select("id,school_id,contract_number").maybeSingle();

  if (error || !contract) {
    console.error("Contract could not be cancelled.", error);
    redirect("/admin/contracts?error=contract-cancel-failed");
  }

  await recordAuditEvent(supabase, {
    schoolId: contract.school_id,
    action: "update",
    entityType: "platform_contracts",
    entityId: contract.id,
    metadata: { contract_number: contract.contract_number, status: "cancelled" },
    actorId: user.id,
  });
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

  const today = new Date().toISOString().slice(0, 10);
  const { data: contract, error } = await supabase.from("platform_contracts")
    .select("id,school_id,contract_number,plan_name,pricing_model,monthly_amount,status,start_date,end_date,subscription_valid_until,renewal_date")
    .eq("id", parsed.data.contractId)
    .maybeSingle();

  if (error || !contract) {
    console.error("Contract could not be loaded to schedule its invoice.", error);
    redirect("/admin/contracts?error=contract-not-found");
  }

  if (contract.status === "cancelled" || !["monthly", "annual", "custom"].includes(contract.pricing_model)) {
    redirect("/admin/contracts?error=invalid-contract-action");
  }
  const { data: openBills, error: openBillsError } = await supabase.from("platform_bills")
    .select("id,total_amount,paid_amount")
    .eq("contract_id", contract.id);
  if (openBillsError) {
    console.error("Existing contract invoices could not be checked before renewal.", openBillsError);
    redirect("/admin/contracts?error=contract-invoice-create-failed");
  }
  if ((openBills ?? []).some((bill) => Number(bill.paid_amount ?? 0) < Number(bill.total_amount))) {
    redirect("/admin/contracts?success=contract-invoice-scheduled");
  }

  const paidThrough = contract.subscription_valid_until ?? contract.renewal_date;
  const periodStart = paidThrough && paidThrough >= today
    ? addDaysToDate(paidThrough, 1)
    : today;
  const renewalEndDate = String(formData.get("renewalEndDate") ?? "").trim();
  if (contract.pricing_model !== "custom" && contract.end_date && periodStart > contract.end_date) {
    redirect("/admin/contracts?error=contract-term-expired");
  }
  if (contract.pricing_model === "custom") {
    try {
      getBillingPeriodEnd(periodStart, "custom", renewalEndDate);
    } catch {
      redirect("/admin/contracts?error=invalid-contract-action");
    }
    if (!renewalEndDate) redirect("/admin/contracts?error=invalid-contract-action");
  }
  const invoiceCreated = await createContractInvoice({
    supabase,
    contractId: contract.id,
    schoolId: contract.school_id,
    planName: contract.plan_name,
    pricingModel: contract.pricing_model as PlatformBillingModel,
    monthlyAmount: Number(contract.monthly_amount),
    startDate: periodStart,
    endDate: contract.pricing_model === "custom" ? renewalEndDate : contract.end_date,
    dueDate: addDaysToDate(periodStart, -7),
    createdBy: user.id,
  });
  if (!invoiceCreated) redirect("/admin/contracts?error=contract-invoice-create-failed");

  await recordAuditEvent(supabase, {
    schoolId: contract.school_id,
    action: "create",
    entityType: "platform_contracts",
    entityId: contract.id,
    metadata: { contract_number: contract.contract_number, action: "renewal_invoice_scheduled", billing_period_start: periodStart },
    actorId: user.id,
  });
  redirect("/admin/contracts?success=contract-invoice-scheduled");
}

export async function updateSchoolTrial(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/dashboard?error=not-authorized");
  }

  const parsed = trialLifecycleSchema.safeParse({
    trialId: formData.get("trialId"),
    status: formData.get("status"),
    endsOn: formData.get("endsOn"),
    seats: formData.get("seats"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) redirect("/admin/trials?error=invalid-trial-action");

  const { data: trial, error: lookupError } = await supabase.from("school_trials")
    .select("id,school_id,trial_name,status")
    .eq("id", parsed.data.trialId)
    .maybeSingle();
  if (lookupError || !trial) {
    console.error("School trial could not be loaded for update.", lookupError);
    redirect("/admin/trials?error=trial-not-found");
  }

  const { error } = await supabase.from("school_trials").update({
    status: parsed.data.status,
    ends_on: parsed.data.endsOn,
    seats: parsed.data.seats,
    notes: parsed.data.notes || null,
  }).eq("id", trial.id).eq("school_id", trial.school_id);
  if (error) {
    console.error("School trial update failed.", error);
    redirect("/admin/trials?error=trial-update-failed");
  }

  if (parsed.data.status === "active") {
    const { error: schoolActivationError } = await supabase.from("schools")
      .update({ is_active: true })
      .eq("id", trial.school_id);
    if (schoolActivationError) {
      console.error("School could not be enabled for its active trial.", schoolActivationError);
      redirect("/admin/trials?error=trial-update-failed");
    }
  }

  await recordAuditEvent(supabase, {
    schoolId: trial.school_id,
    action: "update",
    entityType: "school_trials",
    entityId: trial.id,
    metadata: { trial_name: trial.trial_name, status: parsed.data.status, ends_on: parsed.data.endsOn, seats: parsed.data.seats },
    actorId: user.id,
  });
  redirect("/admin/trials?success=trial-updated");
}

export async function setMasterAdminSchoolStatus(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isMasterAdminUser(supabase, user.id))) {
    redirect("/dashboard?error=not-authorized");
  }

  const parsed = z.object({
    schoolId: postgresUuidSchema,
    isActive: z.enum(["true", "false"]),
  }).safeParse({
    schoolId: formData.get("schoolId"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) redirect("/admin/schools?error=invalid-school-status");

  const { data: school, error: lookupError } = await supabase.from("schools")
    .select("id,name,is_active")
    .eq("id", parsed.data.schoolId)
    .maybeSingle();
  if (lookupError || !school) {
    console.error("School could not be loaded for status update.", lookupError);
    redirect("/admin/schools?error=school-not-found");
  }

  const isActive = parsed.data.isActive === "true";
  const { error } = await supabase.from("schools").update({ is_active: isActive }).eq("id", school.id);
  if (error) {
    console.error("Master Admin school status update failed.", error);
    redirect("/admin/schools?error=school-status-update-failed");
  }

  await recordAuditEvent(supabase, {
    schoolId: school.id,
    action: "update",
    entityType: "schools",
    entityId: school.id,
    metadata: { field: "is_active", previous: school.is_active, current: isActive, school_name: school.name },
    actorId: user.id,
  });
  redirect(`/admin/schools?success=${isActive ? "school-activated" : "school-deactivated"}`);
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
