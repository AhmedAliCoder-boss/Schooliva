"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireHrmContext } from "@/lib/hrm/context";
import { isSupportedProfileImage } from "@/lib/security/profile-image";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  candidateSchema,
  candidateStageSchema,
  hireSubjectAssignmentsSchema,
  interviewSchema,
  interviewStatusSchema,
  jobOpeningSchema,
  type HrmFormState,
} from "@/lib/hrm/schemas";

function values(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function invalid(error: { flatten: () => { fieldErrors: Record<string, string[]> } }): HrmFormState {
  return { fieldErrors: error.flatten().fieldErrors };
}

export async function updateEmployeeVerification(
  _: HrmFormState | undefined,
  formData: FormData,
): Promise<HrmFormState> {
  const parsed = z.object({
    employeeId: z.string().uuid(),
    employeeType: z.enum(["teacher", "staff"]),
    documentType: z.enum(["profile_photo", "national_id", "qualification", "experience", "police_verification"]),
  }).safeParse(values(formData));
  if (!parsed.success) return { error: "Choose a valid employee record." };

  const { supabase, schoolId, user } = await requireHrmContext("manage");
  const { employeeId, employeeType } = parsed.data;
  const employeeQuery = employeeType === "teacher"
    ? supabase.from("teachers").select("id,profile_id,photo_path").eq("id", employeeId).eq("school_id", schoolId).maybeSingle()
    : supabase.from("staff").select("id,profile_id,photo_path").eq("id", employeeId).eq("school_id", schoolId).maybeSingle();
  const { data: employee, error: employeeError } = await employeeQuery;
  if (employeeError) {
    console.error("Could not load employee before saving verification files.", employeeError);
    return { error: "Employee details could not be verified." };
  }
  if (!employee) return { error: "The employee was not found in this school." };

  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose one file to upload." };
  if (file.size > 5 * 1024 * 1024) return { error: "Files must be 5 MB or smaller. Upload one file at a time." };

  const imageTypes = ["image/jpeg", "image/png", "image/webp"];
  const isPhoto = parsed.data.documentType === "profile_photo";
  if (isPhoto ? !imageTypes.includes(file.type) : !["application/pdf", ...imageTypes].includes(file.type)) {
    return { error: isPhoto ? "Use a JPEG, PNG, or WebP employee photo." : "Use a PDF, JPEG, PNG, or WebP document." };
  }
  if (isPhoto || file.type !== "application/pdf") {
    if (!await isSupportedProfileImage(file)) return { error: "The file content does not match its image type." };
  } else {
    const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (new TextDecoder().decode(signature) !== "%PDF-") return { error: "The file does not appear to be a valid PDF." };
  }

  const extensionByType: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensionByType[file.type];

  if (isPhoto) {
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) return { error: "Employee photo upload is not configured on the server." };
    const photoPath = `${employee.profile_id ?? employeeId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await adminClient.storage.from("profile-avatars").upload(photoPath, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      console.error("Could not upload employee photo.", uploadError);
      return { error: "Employee photo could not be uploaded. Check the private profile photo bucket configuration." };
    }

    const employeeTable = employeeType === "teacher" ? "teachers" : "staff";
    const { error: photoUpdateError } = await adminClient.from(employeeTable)
      .update({ photo_path: photoPath }).eq("id", employeeId).eq("school_id", schoolId);
    if (photoUpdateError) {
      console.error("Could not save employee photo path.", photoUpdateError);
      const { error: cleanupError } = await adminClient.storage.from("profile-avatars").remove([photoPath]);
      if (cleanupError) console.error("Could not clean up an unlinked employee photo.", cleanupError);
      return { error: cleanupError
        ? "Employee photo could not be linked and its uploaded file could not be removed."
        : "Employee photo could not be linked to the employee record." };
    }

    if (employee.profile_id) {
      const { error: profileUpdateError } = await adminClient.from("profiles")
        .update({ avatar_path: photoPath }).eq("id", employee.profile_id);
      if (profileUpdateError) {
        console.error("Could not update the employee profile avatar.", profileUpdateError);
        const { error: rollbackError } = await adminClient.from(employeeTable)
          .update({ photo_path: employee.photo_path }).eq("id", employeeId).eq("school_id", schoolId);
        const { error: cleanupError } = await adminClient.storage.from("profile-avatars").remove([photoPath]);
        if (rollbackError) console.error("Could not roll back the employee photo path.", rollbackError);
        if (cleanupError) console.error("Could not clean up an unlinked employee photo.", cleanupError);
        return { error: rollbackError || cleanupError
          ? "Employee photo could not be saved and rollback needs administrator attention."
          : "Employee photo could not be linked to the employee profile." };
      }
    }

    if (employee.photo_path && employee.photo_path !== photoPath) {
      const { error: removeError } = await adminClient.storage.from("profile-avatars").remove([employee.photo_path]);
      if (removeError) console.error("Could not remove the replaced employee photo.", removeError);
    }
  } else {
    const storagePath = `${schoolId}/${employeeType}/${employeeId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("employee-verification").upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      console.error("Could not upload an employee verification document.", uploadError);
      return { error: "The document could not be uploaded. Check your school access and try again." };
    }

    const { error: recordError } = await supabase.from("hrm_employee_documents").insert({
      school_id: schoolId,
      employee_type: employeeType,
      employee_id: employeeId,
      document_type: parsed.data.documentType,
      storage_path: storagePath,
      original_name: file.name.slice(0, 255),
      content_type: file.type,
      file_size: file.size,
      uploaded_by: user.id,
    });
    if (recordError) {
      console.error("Could not save employee verification document metadata.", recordError);
      const { error: cleanupError } = await supabase.storage.from("employee-verification").remove([storagePath]);
      if (cleanupError) console.error("Could not remove an unrecorded employee document.", cleanupError);
      return { error: cleanupError
        ? "The document record could not be saved and the uploaded file could not be removed."
        : "The document record could not be saved; the uploaded file was removed." };
    }
  }

  revalidatePath(`/staff/${employeeId}`);
  revalidatePath(`/teachers/${employeeId}`);
  revalidatePath(`/hrm/employees/${employeeType}/${employeeId}/id-card`);
  revalidatePath("/hrm/employees");
  return { success: isPhoto ? "Employee photo saved." : "Verification document uploaded for review." };
}

export async function reviewEmployeeVerificationDocument(
  _: HrmFormState | undefined,
  formData: FormData,
): Promise<HrmFormState> {
  const parsed = z.object({
    employeeId: z.string().uuid(),
    employeeType: z.enum(["teacher", "staff"]),
    documentId: z.string().uuid(),
    status: z.enum(["pending", "verified", "rejected"]),
  }).safeParse(values(formData));
  if (!parsed.success) return { error: "Choose a valid verification status." };

  const { supabase } = await requireHrmContext("manage");
  const { error } = await supabase.rpc("review_hrm_employee_document", {
    p_document_id: parsed.data.documentId,
    p_status: parsed.data.status,
  });
  if (error) {
    console.error("Could not update employee document verification status.", error);
    return { error: "The verification status could not be saved. Confirm your HRM review access." };
  }

  revalidatePath(`/${parsed.data.employeeType === "teacher" ? "teachers" : "staff"}/${parsed.data.employeeId}`);
  revalidatePath("/hrm/employees");
  return { success: "Document verification status saved." };
}

export async function createJobOpening(_: HrmFormState | undefined, formData: FormData): Promise<HrmFormState> {
  const parsed = jobOpeningSchema.safeParse(values(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, schoolId, user } = await requireHrmContext("manage");
  const { error } = await supabase.from("hrm_job_openings").insert({
    school_id: schoolId,
    title: parsed.data.title,
    department: parsed.data.department || null,
    employee_type: parsed.data.employeeType,
    employment_type: parsed.data.employmentType,
    location: parsed.data.location || null,
    description: parsed.data.description || null,
    requirements: parsed.data.requirements || null,
    closing_date: parsed.data.closingDate || null,
    status: parsed.data.status,
    created_by: user.id,
  });
  if (error) {
    console.error("Could not create HRM job opening.", error);
    return { error: "The vacancy could not be saved. Please review the details and try again." };
  }
  revalidatePath("/hrm");
  revalidatePath("/hrm/jobs");
  return { success: "Vacancy saved." };
}

export async function setJobOpeningStatus(_: HrmFormState | undefined, formData: FormData): Promise<HrmFormState> {
  const parsed = z.object({
    jobId: z.string().uuid(),
    status: z.enum(["draft", "open", "closed"]),
  }).safeParse(values(formData));
  if (!parsed.success) {
    return { error: "Choose a valid vacancy and status." };
  }
  const { supabase, schoolId } = await requireHrmContext("manage");
  const { data, error } = await supabase.from("hrm_job_openings").update({ status: parsed.data.status })
    .eq("id", parsed.data.jobId).eq("school_id", schoolId).select("id").maybeSingle();
  if (error) {
    console.error("Could not update HRM job opening status.", error);
    return { error: "Vacancy status could not be updated." };
  }
  if (!data) return { error: "The vacancy was not found in this school." };
  revalidatePath("/hrm");
  revalidatePath("/hrm/jobs");
  return { success: "Vacancy status updated." };
}

export async function addHrmCandidate(_: HrmFormState | undefined, formData: FormData): Promise<HrmFormState> {
  const parsed = candidateSchema.safeParse(values(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, schoolId } = await requireHrmContext("manage");
  if (parsed.data.jobId) {
    const { data: job, error: jobError } = await supabase.from("hrm_job_openings")
      .select("id")
      .eq("id", parsed.data.jobId)
      .eq("school_id", schoolId)
      .eq("status", "open")
      .maybeSingle();
    if (jobError) {
      console.error("Could not validate the candidate's vacancy.", jobError);
      return { error: "The selected vacancy could not be verified." };
    }
    if (!job) return { error: "Select an open vacancy from this school." };
  }
  const { error } = await supabase.from("hrm_candidates").insert({
    school_id: schoolId,
    job_id: parsed.data.jobId || null,
    candidate_name: parsed.data.candidateName,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    source: parsed.data.source,
    notes: parsed.data.notes || null,
  });
  if (error) {
    console.error("Could not save HRM candidate.", error);
    return { error: "Candidate could not be saved." };
  }
  revalidatePath("/hrm");
  revalidatePath("/hrm/candidates");
  return { success: "Candidate added to the hiring pipeline." };
}

export async function updateCandidateStage(_: HrmFormState | undefined, formData: FormData): Promise<HrmFormState> {
  if (formData.get("stage") === "hired") {
    return { error: "Use Complete hire to create the employee record. The ID card unlocks after the photo and document verification are complete." };
  }
  const parsed = candidateStageSchema.safeParse(values(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, schoolId } = await requireHrmContext("manage");
  if (parsed.data.jobId) {
    const { data: job, error: jobError } = await supabase.from("hrm_job_openings")
      .select("id")
      .eq("id", parsed.data.jobId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (jobError) {
      console.error("Could not validate the candidate vacancy assignment.", jobError);
      return { error: "The selected vacancy could not be verified." };
    }
    if (!job) return { error: "Select a vacancy from this school." };
  }
  if (parsed.data.stage === "offer" && !parsed.data.jobId) {
    return { error: "Assign a vacancy before moving a candidate to the offer stage." };
  }
  const { data, error } = await supabase.from("hrm_candidates")
    .update({ stage: parsed.data.stage, job_id: parsed.data.jobId || null })
    .eq("id", parsed.data.candidateId)
    .eq("school_id", schoolId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Could not update HRM candidate stage.", error);
    return { error: "Candidate stage could not be updated." };
  }
  if (!data) return { error: "The candidate was not found in this school." };
  revalidatePath("/hrm");
  revalidatePath("/hrm/candidates");
  revalidatePath("/hrm/interviews");
  return { success: "Candidate stage updated." };
}

export async function completeHrmHire(_: HrmFormState | undefined, formData: FormData): Promise<HrmFormState> {
  let subjectAssignments: unknown;
  try {
    subjectAssignments = JSON.parse(String(formData.get("subjectAssignments") ?? "[]"));
  } catch {
    return { error: "Teacher subject assignments could not be read. Review the subject selections and try again." };
  }
  const parsed = hireSubjectAssignmentsSchema.safeParse({
    candidateId: formData.get("candidateId"),
    employeeType: formData.get("employeeType"),
    academicSessionId: formData.get("academicSessionId") ?? "",
    subjectAssignments,
  });
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, schoolId } = await requireHrmContext("manage");

  const { data: candidate, error: candidateError } = await supabase.from("hrm_candidates")
    .select("id,candidate_name,stage,job_id,email,job:hrm_job_openings(employee_type)")
    .eq("id", parsed.data.candidateId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (candidateError || !candidate) {
    if (candidateError) console.error("Could not verify candidate before hire completion.", candidateError);
    return { error: "The candidate could not be verified for hiring." };
  }
  if (candidate.stage !== "offer" || !candidate.job_id) {
    return { error: "Assign a vacancy and move the candidate to offer stage before completing the hire." };
  }

  const job = Array.isArray(candidate.job) ? candidate.job[0] : candidate.job;
  if (!job || job.employee_type !== parsed.data.employeeType) {
    return { error: "The selected employee type no longer matches the candidate's vacancy. Refresh and try again." };
  }

  if (job.employee_type === "teacher") {
    const assignments = parsed.data.subjectAssignments;
    const subjectIds = [...new Set(assignments.map((assignment) => assignment.subjectId))];
    const classIds = [...new Set(assignments.flatMap((assignment) => assignment.classId ? [assignment.classId] : []))];
    const [
      { data: session, error: sessionError },
      { data: subjects, error: subjectsError },
      { data: classes, error: classesError },
      { data: classSubjects, error: classSubjectsError },
    ] = await Promise.all([
      supabase.from("academic_sessions").select("id").eq("id", parsed.data.academicSessionId).eq("school_id", schoolId).eq("status", "active").maybeSingle(),
      supabase.from("subjects").select("id").eq("school_id", schoolId).eq("status", "active").in("id", subjectIds),
      classIds.length
        ? supabase.from("classes").select("id").eq("school_id", schoolId).eq("status", "active").in("id", classIds)
        : Promise.resolve({ data: [], error: null }),
      classIds.length
        ? supabase.from("class_subjects").select("class_id,subject_id").eq("school_id", schoolId).in("class_id", classIds).in("subject_id", subjectIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (sessionError || subjectsError || classesError || classSubjectsError) {
      console.error("Teacher subject assignments could not be verified before hire.", sessionError ?? subjectsError ?? classesError ?? classSubjectsError);
      return { error: "Teacher subjects, class assignments, or academic session could not be verified. Refresh and try again." };
    }
    if (!session || subjects?.length !== subjectIds.length || classes?.length !== classIds.length) {
      return { error: "Choose an active academic session, subject, and optional class from this school." };
    }
    const validClassAssignments = new Set((classSubjects ?? []).map((item) => `${item.class_id}:${item.subject_id}`));
    if (assignments.some((assignment) => assignment.classId && !validClassAssignments.has(`${assignment.classId}:${assignment.subjectId}`))) {
      return { error: "Each selected class must already have the matching subject assigned in School Setup." };
    }
  }

  const { data, error } = await supabase.rpc("complete_hrm_hire_with_subjects", {
    p_candidate_id: parsed.data.candidateId,
    p_documents: [],
    p_photo_path: null,
    p_school_id: schoolId,
    p_academic_session_id: parsed.data.academicSessionId || null,
    p_subject_assignments: parsed.data.subjectAssignments.map((assignment) => ({
      subjectId: assignment.subjectId,
      classId: assignment.classId || null,
    })),
  });
  if (error) {
    console.error("Could not complete the HRM hire.", {
      code: error.code,
      message: error.message,
    });
    const knownMessage = [
      "offer stage",
      "vacancy",
      "permission",
      "Principal",
      "role",
      "already been completed",
      "was not found",
      "sequence is full",
      "must be provided as an array",
      "photo, national ID, and qualification documents are required",
      "active academic session",
      "Duplicate teacher subject",
      "active subjects and only classes",
      "Assign at least one subject",
      "only valid for teacher hires",
    ].some((part) => error.message.includes(part));
    if (knownMessage) return { error: error.message };

    const guidance = error.code === "23505"
      ? "An employee ID or employee record already exists."
      : error.code === "23503"
        ? "A required school, candidate, or vacancy record is missing."
        : error.code === "23502"
          ? "A required employee field is missing."
          : error.code === "23514"
            ? "The candidate or employee data does not satisfy a database rule."
            : `Database error ${error.code ?? "unknown"}.`;
    return { error: `Hiring failed. ${guidance} Refresh the page and contact support if it continues.` };
  }
  const hire = Array.isArray(data) ? data[0] : data;
  const employeeId = hire?.employee_id as string | undefined;
  const employeeType = hire?.employee_type as string | undefined;
  const employeeCode = hire?.employee_code as string | undefined;
  if (!employeeId || !employeeType || !employeeCode) {
    throw new Error("Hiring completed without returning the employee identity.");
  }
  if (employeeType !== "teacher" && employeeType !== "staff") {
    throw new Error("Hiring returned an unsupported employee type.");
  }
  revalidatePath("/hrm");
  revalidatePath("/hrm/candidates");
  revalidatePath("/hrm/interviews");
  revalidatePath("/staff");
  revalidatePath("/teachers");
  return {
    success: `Employee record created with ID ${employeeCode}. Add the photo and verification documents from the employee profile.`,
    employeeCode,
  };
}

export async function requestHrmEmployeeAccount(_: HrmFormState | undefined, formData: FormData): Promise<HrmFormState> {
  const parsed = z.object({
    employeeId: z.string().uuid(),
    employeeType: z.enum(["teacher", "staff"]),
    email: z.string().trim().email().max(254),
    username: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9._-]+$/),
    roleId: z.string().uuid(),
  }).safeParse(values(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { supabase, schoolId } = await requireHrmContext("manage");
  const { data: requestId, error } = await supabase.rpc("request_hrm_employee_account", {
    p_school_id: schoolId,
    p_employee_type: parsed.data.employeeType,
    p_employee_id: parsed.data.employeeId,
    p_email: parsed.data.email,
    p_username: parsed.data.username,
    p_role_id: parsed.data.roleId,
  });
  if (error) {
    console.error("Could not submit HRM employee account request.", error);
    if (error.code === "23505") return { error: "An account request is already pending for this employee." };
    return { error: error.message.includes("already has a login")
      ? "This employee already has a login account."
      : error.message.includes("School Admin or Principal")
        ? "Only a School Admin or Principal can request an employee account."
        : "The account request could not be submitted. Check the employee and requested role." };
  }
  if (typeof requestId !== "string") {
    throw new Error("Employee account request was not created with an identifier.");
  }

  revalidatePath(`/staff/${parsed.data.employeeId}`);
  revalidatePath(`/teachers/${parsed.data.employeeId}`);
  revalidatePath("/admin/accounts/requests");
  return { success: "Account request sent to the Master Admin for review." };
}

export async function scheduleHrmInterview(_: HrmFormState | undefined, formData: FormData): Promise<HrmFormState> {
  const parsed = interviewSchema.safeParse(values(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, schoolId } = await requireHrmContext("manage");
  const { data: candidate, error: candidateError } = await supabase.from("hrm_candidates")
    .select("id")
    .eq("id", parsed.data.candidateId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (candidateError) {
    console.error("Could not verify the interview candidate.", candidateError);
    return { error: "The selected candidate could not be verified." };
  }
  if (!candidate) return { error: "Select a candidate from this school." };
  const { error } = await supabase.from("hrm_interviews").insert({
    school_id: schoolId,
    candidate_id: parsed.data.candidateId,
    scheduled_at: new Date(parsed.data.scheduledAt).toISOString(),
    interview_type: parsed.data.interviewType,
    location: parsed.data.location || null,
    interviewer: parsed.data.interviewer || null,
    notes: parsed.data.notes || null,
  });
  if (error) {
    console.error("Could not schedule HRM interview.", error);
    return { error: "Interview could not be scheduled." };
  }
  revalidatePath("/hrm");
  revalidatePath("/hrm/interviews");
  return { success: "Interview scheduled." };
}

export async function updateHrmInterviewStatus(_: HrmFormState | undefined, formData: FormData): Promise<HrmFormState> {
  const parsed = interviewStatusSchema.safeParse(values(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, schoolId } = await requireHrmContext("manage");
  const { data, error } = await supabase.from("hrm_interviews")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.interviewId)
    .eq("school_id", schoolId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Could not update HRM interview status.", error);
    return { error: "Interview status could not be updated." };
  }
  if (!data) return { error: "The interview was not found in this school." };
  revalidatePath("/hrm");
  revalidatePath("/hrm/interviews");
  return { success: "Interview status updated." };
}
