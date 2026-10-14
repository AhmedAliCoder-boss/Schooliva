"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDocumentContext } from "@/lib/documents/context";
import { certificateReviewSchema, certificateSchema, characterCertificateSchema, slcTcSchema, type DocumentFormState } from "@/lib/documents/schemas";

function values(formData: FormData) { return Object.fromEntries(formData.entries()); }

export type SlcTcExamOption = { id: string; label: string };

export async function getSlcTcStudentDetails(studentId: string): Promise<{
  examOptions?: SlcTcExamOption[];
  feeStatus?: "cleared" | "pending" | "not_recorded";
  error?: string;
}> {
  if (!z.string().uuid().safeParse(studentId).success) return { error: "Select a valid student." };
  const { supabase, schoolId } = await requireDocumentContext("manage");
  const { data: canManageCertificates, error: permissionError } = await supabase.rpc("has_permission", {
    target_school_id: schoolId,
    target_resource: "certificates",
    target_action: "manage",
  });
  if (permissionError) {
    console.error("SLC/TC details permission could not be checked.", permissionError);
    return { error: "Certificate permission could not be verified." };
  }
  if (!canManageCertificates) return { error: "You are not allowed to issue certificates." };

  const [{ data: student, error: studentError }, { data: resultRows, error: resultsError }, { data: invoices, error: invoicesError }] = await Promise.all([
    supabase.from("students").select("id").eq("id", studentId).eq("school_id", schoolId).eq("is_active", true).maybeSingle(),
    supabase.from("published_exam_results")
      .select("exam_id,exam_name,starts_on,obtained_marks,maximum_marks,passing_marks")
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .order("starts_on", { ascending: false }),
    supabase.from("fee_invoices")
      .select("remaining_amount,status")
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .neq("status", "cancelled"),
  ]);
  if (studentError || resultsError || invoicesError) {
    console.error("SLC/TC student exam and fee details could not be loaded.", { studentError, resultsError, invoicesError });
    return { error: "Student exam results or fee status could not be loaded." };
  }
  if (!student) return { error: "Select an active student." };

  const groupedResults = new Map<string, { name: string; obtained: number; maximum: number; failed: boolean }>();
  for (const row of resultRows ?? []) {
    const existing = groupedResults.get(row.exam_id) ?? {
      name: row.exam_name,
      obtained: 0,
      maximum: 0,
      failed: false,
    };
    existing.obtained += Number(row.obtained_marks);
    existing.maximum += Number(row.maximum_marks);
    existing.failed ||= row.passing_marks !== null && Number(row.obtained_marks) < Number(row.passing_marks);
    groupedResults.set(row.exam_id, existing);
  }
  const examOptions = [...groupedResults.entries()].map(([id, result]) => ({
    id,
    label: `${result.name} — ${result.failed ? "Failed" : "Passed"} (${result.maximum > 0 ? `${((result.obtained / result.maximum) * 100).toFixed(1)}%` : "result published"})`,
  }));
  const invoiceRows = invoices ?? [];
  const feeStatus = invoiceRows.some((invoice) => Number(invoice.remaining_amount) > 0)
    ? "pending"
    : invoiceRows.length
      ? "cleared"
      : "not_recorded";
  return { examOptions, feeStatus };
}

export async function issueCertificate(_: DocumentFormState | undefined, formData: FormData): Promise<DocumentFormState> {
  const parsed = certificateSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Certificate form invalid hai." };
  const { supabase, schoolId, user } = await requireDocumentContext("manage");
  const requiresApproval = parsed.data.certificateType === "character" || parsed.data.certificateType === "leaving";
  let certificateNumber = parsed.data.certificateNumber;
  if (requiresApproval) {
    const { data, error } = await supabase.rpc("next_student_certificate_number", { target_school_id: schoolId });
    if (error) {
      console.error("Student certificate number could not be generated.", error);
      return { error: "A four-digit certificate number could not be generated." };
    }
    certificateNumber = data;
  }
  if (!certificateNumber) return { error: "Certificate number is required." };
  const content = {
    ...(parsed.data.content ? { text: parsed.data.content } : {}),
    ...(parsed.data.certificateType === "character"
      ? { certificateKind: "character", certificateTitle: "Character Certificate" }
      : {}),
  };
  const { error } = await supabase.from("certificate_records").insert({
    school_id: schoolId,
    student_id: parsed.data.studentId,
    certificate_type: parsed.data.certificateType,
    certificate_number: certificateNumber,
    issued_on: parsed.data.issuedOn,
    content,
    status: requiresApproval ? "pending_approval" : "issued",
    issued_by: user.id,
  });
  if (error) {
    console.error("Certificate could not be created.", error);
    return { error: error.code === "23505" ? "Certificate number already exists." : "Certificate issue nahi hua." };
  }
  revalidatePath("/documents");
  revalidatePath("/slc-tc");
  return { success: requiresApproval
    ? `Certificate ${certificateNumber} approval ke liye bhej diya gaya.`
    : "Certificate issue ho gaya." };
}

export async function issueSlcTc(_: DocumentFormState | undefined, formData: FormData): Promise<DocumentFormState> {
  if (formData.get("certificateKind") === "character") {
    const character = characterCertificateSchema.safeParse(values(formData));
    if (!character.success) return { error: character.error.issues[0]?.message ?? "Character certificate details are invalid." };
    const { supabase, schoolId, user } = await requireDocumentContext("manage");
    const { data: canManageCertificates, error: permissionError } = await supabase.rpc("has_permission", {
      target_school_id: schoolId,
      target_resource: "certificates",
      target_action: "manage",
    });
    if (permissionError) {
      console.error("Character certificate permission could not be checked.", permissionError);
      return { error: "Certificate permission could not be verified." };
    }
    if (!canManageCertificates) return { error: "You are not allowed to issue certificates." };

    const [{ data: student, error: studentError }, { data: enrollment, error: enrollmentError }] = await Promise.all([
      supabase.from("students")
        .select("id,first_name,middle_name,last_name,admission_number,student_identifier")
        .eq("id", character.data.studentId)
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .maybeSingle(),
      supabase.from("student_enrollments")
        .select("id")
        .eq("student_id", character.data.studentId)
        .eq("school_id", schoolId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle(),
    ]);
    if (studentError || enrollmentError) {
      console.error("Character certificate student could not be verified.", { studentError, enrollmentError });
      return { error: "Student record could not be verified." };
    }
    if (!student || !enrollment) return { error: "Select an active, currently enrolled student." };

    const { data: certificateNumber, error: numberError } = await supabase.rpc("next_student_certificate_number", {
      target_school_id: schoolId,
    });
    if (numberError) {
      console.error("Character certificate number could not be generated.", numberError);
      return { error: "A four-digit character certificate number could not be generated." };
    }
    const content = {
      certificateKind: "character",
      certificateTitle: "Character Certificate",
      ...character.data,
      certificateNumber,
      studentName: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" "),
      studentIdentifier: student.student_identifier,
      admissionNumber: student.admission_number,
    };
    const { error } = await supabase.from("certificate_records").insert({
      school_id: schoolId,
      student_id: student.id,
      certificate_type: "character",
      certificate_number: certificateNumber,
      issued_on: character.data.issuedOn,
      content,
      status: "pending_approval",
      issued_by: user.id,
    });
    if (error) {
      console.error("Character certificate could not be issued.", error);
      return { error: error.code === "23505" ? "This certificate number has already been used." : "Character certificate could not be issued." };
    }
    revalidatePath("/slc-tc");
    revalidatePath("/documents");
    return { success: `Character certificate ${certificateNumber} sent for principal / school admin approval.` };
  }

  const kind = formData.get("certificateKind");
  const parsed = slcTcSchema.safeParse({
    ...values(formData),
    ...(kind === "completion" ? { certificateTitle: "School Completion Certificate" } : {}),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "SLC/TC details are invalid." };
  const { supabase, schoolId, user } = await requireDocumentContext("manage");
  const { data: canManageCertificates, error: permissionError } = await supabase.rpc("has_permission", {
    target_school_id: schoolId,
    target_resource: "certificates",
    target_action: "manage",
  });
  if (permissionError) {
    console.error("SLC/TC issuance permission could not be checked.", permissionError);
    return { error: "Certificate permission could not be verified." };
  }
  if (!canManageCertificates) return { error: "You are not allowed to issue certificates." };

  const [{ data: student, error: studentError }, { data: enrollment, error: enrollmentError }, { data: activeSessions, error: activeSessionsError }] = await Promise.all([
    supabase.from("students")
      .select("id,first_name,middle_name,last_name,admission_number,student_identifier,date_of_birth,admission_date")
      .eq("id", parsed.data.studentId)
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("student_enrollments")
      .select("id,academic_session_id")
      .eq("student_id", parsed.data.studentId)
      .eq("school_id", schoolId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
    supabase.from("academic_sessions")
      .select("id,name")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .order("starts_on", { ascending: false }),
  ]);
  if (studentError || enrollmentError || activeSessionsError) {
    console.error("SLC/TC student record or active sessions could not be verified.", { studentError, enrollmentError, activeSessionsError });
    return { error: "Student record could not be verified." };
  }
  if (!student || !enrollment) return { error: "Select an active student who is currently enrolled at this school." };
  if (!student.admission_date) return { error: "The student's official admission date is missing from their record." };
  if (!student.date_of_birth) return { error: "The student's official date of birth is missing from their record." };
  if (student.admission_date !== parsed.data.dateOfAdmission) {
    return { error: "Admission date does not match the student's school record." };
  }
  if (student.date_of_birth !== parsed.data.dateOfBirth) {
    return { error: "Date of birth does not match the student's school record." };
  }

  const [lastClassId, lastSectionId] = parsed.data.lastClassSection.split("|");
  const sessionOptions = activeSessions ?? [];
  const selectedSessionId = sessionOptions.some((session) => session.id === parsed.data.academicSessionId)
    ? parsed.data.academicSessionId
    : sessionOptions.some((session) => session.id === enrollment.academic_session_id)
      ? enrollment.academic_session_id
      : sessionOptions.length === 1
        ? sessionOptions[0].id
        : "";
  if (!selectedSessionId) return { error: "Choose an active academic session, or make the student's enrolled session active first." };
  const [{ data: classRecord, error: classError }, { data: sectionRecord, error: sectionError }, { data: sessionRecord, error: sessionError }, { data: invoices, error: invoicesError }] = await Promise.all([
    supabase.from("classes").select("id,name").eq("id", lastClassId).eq("school_id", schoolId).eq("status", "active").maybeSingle(),
    supabase.from("sections").select("id,name,class_id").eq("id", lastSectionId).eq("class_id", lastClassId).eq("school_id", schoolId).eq("status", "active").maybeSingle(),
    supabase.from("academic_sessions").select("id,name").eq("id", selectedSessionId).eq("school_id", schoolId).eq("status", "active").maybeSingle(),
    supabase.from("fee_invoices").select("remaining_amount,status").eq("school_id", schoolId).eq("student_id", student.id).neq("status", "cancelled"),
  ]);
  if (classError || sectionError || sessionError || invoicesError) {
    console.error("Selected SLC/TC class, section, session, or fee status could not be verified.", { classError, sectionError, sessionError, invoicesError });
    return { error: "Selected class, section, session, or fee status could not be verified." };
  }
  if (!classRecord || !sectionRecord || !sessionRecord) {
    return { error: "Select an active class, section, and current academic session." };
  }
  const invoiceRows = invoices ?? [];
  const registeredFeeStatus = invoiceRows.some((invoice) => Number(invoice.remaining_amount) > 0)
    ? "pending"
    : invoiceRows.length
      ? "cleared"
      : "not_recorded";
  if (parsed.data.feeStatus !== "waived" && parsed.data.feeStatus !== registeredFeeStatus) {
    return { error: "Fee status no longer matches the invoice register. Refresh the page and verify the student's balance." };
  }

  let lastExam = "";
  if (parsed.data.lastExamId) {
    const { data: examResults, error: examResultsError } = await supabase.from("published_exam_results")
      .select("exam_name,obtained_marks,maximum_marks,passing_marks")
      .eq("school_id", schoolId)
      .eq("student_id", student.id)
      .eq("exam_id", parsed.data.lastExamId);
    if (examResultsError) {
      console.error("Selected student exam result could not be verified.", examResultsError);
      return { error: "Selected exam result could not be verified." };
    }
    if (!examResults?.length) return { error: "Choose an exam result recorded for this student." };
    const obtained = examResults.reduce((total, row) => total + Number(row.obtained_marks), 0);
    const maximum = examResults.reduce((total, row) => total + Number(row.maximum_marks), 0);
    const failed = examResults.some((row) => row.passing_marks !== null && Number(row.obtained_marks) < Number(row.passing_marks));
    lastExam = `${examResults[0].exam_name} — ${failed ? "Failed" : "Passed"} (${maximum > 0 ? `${((obtained / maximum) * 100).toFixed(1)}%` : "result published"})`;
  }

  const { data: certificateNumber, error: numberError } = await supabase.rpc("next_student_certificate_number", {
    target_school_id: schoolId,
  });
  if (numberError) {
    console.error("SLC/TC certificate number could not be generated.", numberError);
    return { error: "A four-digit certificate number could not be generated." };
  }
    const content = {
      certificateKind: parsed.data.certificateTitle === "School Completion Certificate" ? "completion" : "slc_tc",
      ...parsed.data,
      certificateNumber,
      academicSessionId: sessionRecord.id,
      dateOfAdmission: student.admission_date,
      dateOfBirth: student.date_of_birth,
      lastClassAttended: `${classRecord.name} · ${sectionRecord.name}`,
      academicSession: sessionRecord.name,
      lastExam,
      studentName: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" "),
      studentIdentifier: student.student_identifier,
      admissionNumber: student.admission_number,
    };
    const { error } = await supabase.from("certificate_records").insert({
      school_id: schoolId,
      student_id: student.id,
      certificate_type: parsed.data.certificateTitle === "School Completion Certificate" ? "completion" : "leaving",
      certificate_number: certificateNumber,
      issued_on: parsed.data.issuedOn,
      content,
      status: "pending_approval",
      issued_by: user.id,
    });
    if (error) {
      console.error("SLC/TC could not be issued.", error);
      return { error: "SLC/TC could not be issued." };
    }
  revalidatePath("/slc-tc");
  revalidatePath("/documents");
  return { success: `${parsed.data.certificateTitle} ${certificateNumber} sent for principal / school admin approval.` };
}

export async function reviewStudentCertificate(
  _: DocumentFormState | undefined,
  formData: FormData,
): Promise<DocumentFormState> {
  const parsed = certificateReviewSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Certificate review details are invalid." };
  const { supabase, schoolId } = await requireDocumentContext("manage");
  const { data: certificate, error: certificateError } = await supabase.from("certificate_records")
    .select("student_id")
    .eq("id", parsed.data.certificateId)
    .eq("school_id", schoolId)
    .eq("status", "pending_approval")
    .in("certificate_type", ["character", "leaving", "completion"])
    .maybeSingle();
  if (certificateError) {
    console.error("Certificate awaiting review could not be loaded.", certificateError);
    return { error: "Certificate request could not be verified." };
  }
  if (!certificate) return { error: "Certificate request was not found or was already reviewed." };

  const { error } = await supabase.rpc("review_student_certificate", {
    target_certificate_id: parsed.data.certificateId,
    target_decision: parsed.data.decision,
    target_notes: parsed.data.notes || null,
  });
  if (error) {
    console.error("Certificate review failed.", error);
    if (error.message.includes("Only a School Admin or Principal")) {
      return { error: "Only a School Admin or Principal can review this certificate." };
    }
    return { error: "Certificate could not be reviewed. Refresh and try again." };
  }

  revalidatePath("/slc-tc");
  revalidatePath("/documents");
  revalidatePath("/students");
  revalidatePath(`/students/${certificate.student_id}`);
  return { success: parsed.data.decision === "approve"
    ? "Certificate approved; student record and active enrollments have been archived."
    : "Certificate request rejected. The student remains active." };
}
