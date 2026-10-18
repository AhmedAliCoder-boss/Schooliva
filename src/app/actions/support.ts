"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { isMasterAdminUser } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { emailSupportInbox, sendSupportEmail } from "@/lib/support/email";
import type { SupportActionState } from "@/lib/support/types";

const createRequestSchema = z.object({
  category: z.enum(["complaint", "issue", "feature_request", "policy_question", "account_access", "billing", "other"]),
  priority: z.enum(["normal", "high", "urgent"]),
  subject: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(5000),
});

const reviewRequestSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["open", "in_review", "planned", "in_progress", "resolved", "declined"]),
  adminResponse: z.string().trim().max(3000),
});

export async function createSupportRequest(
  _previousState: SupportActionState,
  formData: FormData,
): Promise<SupportActionState> {
  const parsed = createRequestSchema.safeParse({
    category: formData.get("category"),
    priority: formData.get("priority"),
    subject: formData.get("subject"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the request details and try again." };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Sign in again before sending a support request." };

  const activeSchool = await getActiveSchoolContext(supabase, user.id);
  if (!activeSchool.schoolId || activeSchool.isMasterAdmin) {
    return { error: "Select a school workspace before sending a support request." };
  }

  const { data: assignments, error: roleError } = await supabase
    .from("user_roles")
    .select("roles!inner(slug)")
    .eq("user_id", user.id)
    .eq("school_id", activeSchool.schoolId);
  if (roleError) {
    console.error("School support access could not be verified.", roleError);
    return { error: "School support access could not be verified." };
  }

  const canCreateRequest = (assignments ?? []).some((assignment) => {
    const role = Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles;
    return role && typeof role === "object" && "slug" in role && ["school_admin", "principal"].includes(String(role.slug));
  });
  if (!canCreateRequest) return { error: "Support requests are available to school administrators and principals." };

  const { data: requestId, error } = await supabase.rpc("create_school_support_request", {
    target_school_id: activeSchool.schoolId,
    target_category: parsed.data.category,
    target_priority: parsed.data.priority,
    target_subject: parsed.data.subject,
    target_description: parsed.data.description,
  });
  if (error || !requestId) {
    console.error("School support request could not be saved.", error);
    return { error: "Your request could not be saved. Please try again." };
  }

  revalidatePath("/support");
  revalidatePath("/admin/support");
  try {
    await emailSupportInbox(
      `[Schooliva support] ${parsed.data.subject}`,
      [
        `Request ID: ${requestId}`,
        `School: ${activeSchool.schoolName ?? "School workspace"}`,
        `Category: ${parsed.data.category.replaceAll("_", " ")}`,
        `Priority: ${parsed.data.priority}`,
        `From: ${user.email ?? "School administrator"}`,
        "",
        parsed.data.description,
        "",
        "Review this request in the Schooliva Master Admin Support inbox.",
      ].join("\n"),
    );
    return { success: `Request saved and sent to the support team. Reference: ${requestId.slice(0, 8).toUpperCase()}.` };
  } catch (emailError) {
    console.error("Support request was saved, but its email alert could not be sent.", emailError);
    return {
      success: `Request saved. Reference: ${requestId.slice(0, 8).toUpperCase()}.`,
      warning: "The in-app support inbox has your request, but its email alert could not be sent. The platform team will still see it in the inbox.",
    };
  }
}

export async function reviewSupportRequest(
  _previousState: SupportActionState,
  formData: FormData,
): Promise<SupportActionState> {
  const parsed = reviewRequestSchema.safeParse({
    requestId: formData.get("requestId"),
    status: formData.get("status"),
    adminResponse: formData.get("adminResponse") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review details are invalid." };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !(await isMasterAdminUser(supabase, user.id))) {
    return { error: "Only a signed-in Master Admin can review support requests." };
  }

  const { data: request, error: requestError } = await supabase
    .from("support_requests")
    .select("school_id,requester_email,subject")
    .eq("id", parsed.data.requestId)
    .maybeSingle();
  if (requestError || !request) {
    console.error("Support request could not be loaded for review.", requestError);
    return { error: "Support request could not be found." };
  }

  const { error } = await supabase.rpc("review_school_support_request", {
    target_request_id: parsed.data.requestId,
    target_status: parsed.data.status,
    target_admin_response: parsed.data.adminResponse,
  });
  if (error) {
    console.error("Support request review could not be saved.", error);
    return { error: "The review could not be saved. Please try again." };
  }

  revalidatePath("/admin/support");
  revalidatePath("/notifications");
  let warning: string | undefined;
  if (request.requester_email) {
    try {
      await sendSupportEmail({
        to: request.requester_email,
        subject: `[Schooliva support] Update: ${request.subject}`,
        text: [
          `Your Schooliva support request "${request.subject}" has been updated.`,
          `Status: ${parsed.data.status.replaceAll("_", " ")}`,
          "",
          parsed.data.adminResponse || "The platform team reviewed your request.",
          "",
          "You can also see this update in your Schooliva notifications.",
        ].join("\n"),
      });
    } catch (emailError) {
      console.error("Support status was saved, but its email could not be sent.", emailError);
      warning = "The request was updated and an in-app notification was sent, but its email could not be delivered.";
    }
  }

  return {
    success: "Request updated. The requester received an in-app notification.",
    ...(warning ? { warning } : {}),
  };
}
