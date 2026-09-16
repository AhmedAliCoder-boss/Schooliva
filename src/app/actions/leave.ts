"use server";

import { revalidatePath } from "next/cache";
import { requireLeaveContext } from "@/lib/leave/context";
import { leaveDecisionSchema, leaveRequestSchema, leaveTypeSchema, type LeaveFormState } from "@/lib/leave/schemas";

function values(formData: FormData) { return Object.fromEntries(formData.entries()); }

export async function saveLeaveType(_: LeaveFormState | undefined, formData: FormData): Promise<LeaveFormState> {
  const parsed = leaveTypeSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Leave type invalid hai." };
  const { supabase, schoolId } = await requireLeaveContext("manage");
  const { error } = await supabase.from("leave_types").insert({ school_id: schoolId, name: parsed.data.name, description: parsed.data.description || null });
  if (error) return { error: error.code === "23505" ? "Leave type already exists." : "Leave type create nahi hua." };
  revalidatePath("/leave"); return { success: "Leave type add ho gaya." };
}

export async function createLeaveRequest(_: LeaveFormState | undefined, formData: FormData): Promise<LeaveFormState> {
  const parsed = leaveRequestSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Leave request invalid hai." };
  const { supabase, schoolId, user } = await requireLeaveContext("manage");
  const subjectColumn = parsed.data.subjectType === "student" ? "student_id" : parsed.data.subjectType === "teacher" ? "teacher_id" : "staff_id";
  const { error } = await supabase.from("leave_requests").insert({
    school_id: schoolId,
    leave_type_id: parsed.data.leaveTypeId,
    requester_profile_id: user.id,
    [subjectColumn]: parsed.data.subjectId,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate,
    reason: parsed.data.reason,
    attachment_path: parsed.data.attachmentPath || null,
  });
  if (error) return { error: "Leave request create nahi hui." };
  revalidatePath("/leave"); return { success: "Leave request submit ho gayi." };
}

export async function decideLeave(_: LeaveFormState | undefined, formData: FormData): Promise<LeaveFormState> {
  const parsed = leaveDecisionSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Leave decision invalid hai." };
  const { supabase, schoolId, user } = await requireLeaveContext("approve");
  const { error } = await supabase.from("leave_requests").update({ status: parsed.data.status, approver_profile_id: user.id, approved_at: new Date().toISOString(), approver_note: parsed.data.approverNote || null }).eq("id", parsed.data.leaveRequestId).eq("school_id", schoolId).eq("status", "requested");
  if (error) return { error: "Leave decision save nahi hui." };
  revalidatePath("/leave"); return { success: `Leave ${parsed.data.status} ho gayi.` };
}
