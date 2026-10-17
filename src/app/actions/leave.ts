"use server";

import { revalidatePath } from "next/cache";
import { requireLeaveContext } from "@/lib/leave/context";
import { leaveDecisionSchema, leaveRequestSchema, leaveTypeSchema, type LeaveFormState } from "@/lib/leave/schemas";

function values(formData: FormData) { return Object.fromEntries(formData.entries()); }

export async function saveLeaveType(_: LeaveFormState | undefined, formData: FormData): Promise<LeaveFormState> {
  const parsed = leaveTypeSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Leave type is invalid." };
  const { supabase, schoolId } = await requireLeaveContext("manage");
  const { error } = await supabase.from("leave_types").insert({ school_id: schoolId, name: parsed.data.name, description: parsed.data.description || null });
  if (error) return { error: error.code === "23505" ? "Leave type already exists." : "Leave type could not be created." };
  revalidatePath("/leave"); return { success: "Leave type added." };
}

export async function createLeaveRequest(_: LeaveFormState | undefined, formData: FormData): Promise<LeaveFormState> {
  const parsed = leaveRequestSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Leave request is invalid." };
  const { supabase, schoolId, user } = await requireLeaveContext("manage");
  const fileValue = formData.get("document");
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  if (file && file.size > 5 * 1024 * 1024) return { error: "Document must be smaller than 5 MB." };
  if (file && !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
    return { error: "Upload a PDF, JPG, or PNG document." };
  }
  if (file) {
    const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const isPdf = file.type === "application/pdf" && new TextDecoder().decode(signature.slice(0, 5)) === "%PDF-";
    const isJpeg = file.type === "image/jpeg" && signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
    const isPng = file.type === "image/png" && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => signature[index] === byte);
    if (!isPdf && !isJpeg && !isPng) return { error: "Document content does not match the selected file type." };
  }

  const suppliedPath = parsed.data.attachmentPath || "";
  if (file && suppliedPath) return { error: "Upload a document or provide an existing attachment path, not both." };
  if (suppliedPath && !suppliedPath.startsWith(`${schoolId}/${user.id}/`)) {
    return { error: "The attachment path does not match your school's private folder for this account." };
  }

  const extensionByType: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
  };
  const storagePath = file
    ? `${schoolId}/${user.id}/${crypto.randomUUID()}.${extensionByType[file.type]}`
    : suppliedPath || null;
  if (file && storagePath) {
    const { error: uploadError } = await supabase.storage.from("leave-attachments").upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      console.error("Leave document could not be uploaded.", uploadError);
      return { error: "Document could not be uploaded. Check the private leave-attachments bucket." };
    }
  }

  const subjectColumn = parsed.data.subjectType === "student" ? "student_id" : parsed.data.subjectType === "teacher" ? "teacher_id" : "staff_id";
  const { data: request, error } = await supabase.from("leave_requests").insert({
    school_id: schoolId,
    leave_type_id: parsed.data.leaveTypeId,
    requester_profile_id: user.id,
    [subjectColumn]: parsed.data.subjectId,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate,
    reason: parsed.data.reason,
    attachment_path: storagePath,
  }).select("id").single();
  if (error || !request) {
    console.error("Leave request could not be created.", error);
    const { error: cleanupError } = file && storagePath
      ? await supabase.storage.from("leave-attachments").remove([storagePath])
      : { error: null };
    if (cleanupError) console.error("Could not clean up the unlinked leave document.", cleanupError);
    return { error: cleanupError
      ? "Leave request could not be created, and the uploaded document could not be removed. Contact an administrator."
      : "Leave request could not be created." };
  }

  if (storagePath) {
    const fileName = file?.name || storagePath.split("/").at(-1) || "Leave attachment";
    const { error: attachmentError } = await supabase.from("leave_attachments").insert({
      school_id: schoolId,
      leave_request_id: request.id,
      file_path: storagePath,
      file_name: fileName,
      mime_type: file?.type || null,
      uploaded_by: user.id,
    });
    if (attachmentError) {
      console.error("Leave document could not be linked to its request.", attachmentError);
      const { error: updateError } = await supabase.from("leave_requests").update({ attachment_path: null }).eq("id", request.id).eq("school_id", schoolId);
      if (updateError) console.error("Could not clear the unlinked leave document path.", updateError);
      const { error: cleanupError } = file
        ? await supabase.storage.from("leave-attachments").remove([storagePath])
        : { error: null };
      if (cleanupError) console.error("Could not clean up the unlinked leave document.", cleanupError);
      revalidatePath("/leave");
      return { success: updateError || cleanupError
        ? "Leave request saved, but the document could not be linked. Notify an administrator."
        : "Leave request saved, but the document could not be linked. Edit the request and attach it again." };
    }
  }
  revalidatePath("/leave");
  return { success: `Leave request submitted${storagePath ? " and document attached." : "."}` };
}

export async function decideLeave(_: LeaveFormState | undefined, formData: FormData): Promise<LeaveFormState> {
  const parsed = leaveDecisionSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Leave decision is invalid." };
  const { supabase, schoolId, user } = await requireLeaveContext("approve");
  const { error } = await supabase.from("leave_requests").update({ status: parsed.data.status, approver_profile_id: user.id, approved_at: new Date().toISOString(), approver_note: parsed.data.approverNote || null }).eq("id", parsed.data.leaveRequestId).eq("school_id", schoolId).eq("status", "requested");
  if (error) return { error: "Leave decision could not be saved." };
  revalidatePath("/leave"); return { success: `Leave request ${parsed.data.status}.` };
}
