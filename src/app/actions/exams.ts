"use server";
import { revalidatePath } from "next/cache";
import { requireExamContext, requireGradingContext } from "@/lib/exams/context";
import { examScheduleSchema, examSchema, examSubjectSchema, examTypeSchema, gradeBoundarySchema, gradingScaleSchema, marksSubmissionSchema, type ExamFormState } from "@/lib/exams/schemas";
function values(formData: FormData) { return Object.fromEntries(formData.entries()); }

export async function createExam(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const parsed = examSchema.safeParse(values(formData)); if (!parsed.success) return { error: "Complete all required exam fields." };
  const { supabase, schoolId, user } = await requireExamContext("manage");
  const [
    { data: examType, error: examTypeError },
    { data: session, error: sessionError },
    { data: gradingScale, error: gradingScaleError },
  ] = await Promise.all([
    supabase.from("exam_types").select("id").eq("id", parsed.data.examTypeId).eq("school_id", schoolId).eq("is_active", true).maybeSingle(),
    supabase.from("academic_sessions").select("id").eq("id", parsed.data.academicSessionId).eq("school_id", schoolId).maybeSingle(),
    parsed.data.gradingScaleId
      ? supabase.from("grading_scales").select("id").eq("id", parsed.data.gradingScaleId).eq("school_id", schoolId).eq("is_active", true).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (examTypeError || sessionError || gradingScaleError) {
    console.error("Exam setup references could not be verified.", examTypeError ?? sessionError ?? gradingScaleError);
    return { error: "Exam setup could not be verified. Refresh and try again." };
  }
  if (!examType || !session || (parsed.data.gradingScaleId && !gradingScale)) {
    return { error: "Select an active exam type, academic session, and grading scale from this school." };
  }
  const { error } = await supabase.from("exams").insert({ school_id: schoolId, exam_type_id: parsed.data.examTypeId, academic_session_id: parsed.data.academicSessionId, name: parsed.data.name, starts_on: parsed.data.startsOn, ends_on: parsed.data.endsOn, grading_scale_id: parsed.data.gradingScaleId || null, created_by: user.id });
  if (error) return { error: error.code === "23505" ? "An exam with this name already exists." : "Exam could not be created." }; revalidatePath("/exams"); return { success: "Exam created." };
}

export async function changeExamSectionStatus(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const examId = String(formData.get("examId") ?? "");
  const sectionId = String(formData.get("sectionId") ?? "");
  const nextStatus = String(formData.get("nextStatus") ?? "");
  if (!examId || !sectionId || !["submitted", "reviewed", "published"].includes(nextStatus)) {
    return { error: "Exam section workflow request is invalid." };
  }
  const { supabase, schoolId } = await requireExamContext("manage");
  const { data: overallStatus, error } = await supabase.rpc("transition_exam_section_workflow", {
    p_school_id: schoolId,
    p_exam_id: examId,
    p_section_id: sectionId,
    p_next_status: nextStatus,
  });
  if (error) {
    const knownMessages = [
      "Schedule every exam subject",
      "Enter marks for every enrolled student",
      "section is not part of this exam",
      "section workflow must move",
      "Only exam managers",
    ];
    if (knownMessages.some((message) => error.message.includes(message))) return { error: error.message };
    console.error("Exam section workflow transition failed.", error);
    return { error: "Exam section workflow could not be updated. Refresh and try again." };
  }
  revalidatePath("/exams");
  revalidatePath(`/exams/${examId}`);
  revalidatePath("/exams/timetable");
  return {
    success: overallStatus === "published"
      ? "All active sections are published. The exam is now complete."
      : `Section ${nextStatus}. Overall exam status: ${String(overallStatus ?? "pending")}.`,
  };
}

export async function saveExamType(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const parsed = examTypeSchema.safeParse(values(formData)); if (!parsed.success) return { error: "Complete all required exam type fields." };
  const { supabase, schoolId } = await requireExamContext("manage");
  const { error } = await supabase.from("exam_types").insert({ school_id: schoolId, name: parsed.data.name, description: parsed.data.description || null });
  if (error) {
    console.error("Exam type could not be added.", error);
    if (error.code === "23505") return { error: "An exam type with this name already exists." };
    if (error.code === "42501") return { error: "You do not have permission to add exam types for this school." };
    return { error: "Exam type could not be added. Refresh and try again." };
  }
  revalidatePath("/exams");
  return { success: "Exam type added." };
}

export async function saveGradingScale(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const parsed = gradingScaleSchema.safeParse(values(formData)); if (!parsed.success) return { error: "Complete all required grading scale fields." };
  const { supabase, schoolId } = await requireGradingContext("manage");
  const { error } = await supabase.from("grading_scales").insert({ school_id: schoolId, name: parsed.data.name, description: parsed.data.description || null });
  if (error) return { error: error.code === "23505" ? "A grading scale with this name already exists." : "Grading scale could not be added." }; revalidatePath("/exams"); return { success: "Grading scale added." };
}

export async function addGradeBoundary(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const parsed = gradeBoundarySchema.safeParse(values(formData)); if (!parsed.success) return { error: "Complete all required grade boundary fields." };
  const { supabase, schoolId } = await requireGradingContext("manage");
  const { data: scale } = await supabase.from("grading_scales").select("school_id").eq("id", parsed.data.gradingScaleId).maybeSingle();
  if (!scale || String(scale.school_id) !== schoolId) return { error: "Select a grading scale from this school." };
  const { error } = await supabase.from("grade_boundaries").insert({ grading_scale_id: parsed.data.gradingScaleId, grade: parsed.data.grade, min_percentage: parsed.data.minPercentage, max_percentage: parsed.data.maxPercentage, grade_point: parsed.data.gradePoint === "" ? null : parsed.data.gradePoint, remark: parsed.data.remark || null });
  if (error) return { error: error.code === "23505" ? "This grade already exists in this grading scale." : "Grade boundary could not be added." }; revalidatePath("/exams"); return { success: "Grade boundary added." };
}

export async function saveExamSubject(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const parsed = examSubjectSchema.safeParse(values(formData)); if (!parsed.success) return { error: "Complete all required exam subject fields." };
  const { supabase, schoolId } = await requireExamContext("manage");
  const { data, error } = await supabase.rpc("add_exam_subject_to_class", {
    p_school_id: schoolId,
    p_exam_id: parsed.data.examId,
    p_class_id: parsed.data.classId,
    p_subject_id: parsed.data.subjectId,
    p_maximum_marks: parsed.data.maximumMarks,
    p_passing_marks: parsed.data.passingMarks === "" ? null : parsed.data.passingMarks,
  });
  if (error) {
    const knownMessages = [
      "Only exam managers",
      "draft exam",
      "active class",
      "active school subject",
      "already exists",
      "section marking starts",
    ];
    if (knownMessages.some((message) => error.message.includes(message))) {
      return { error: error.message };
    }
    console.error("Exam subject could not be added to the selected class.", error);
    return { error: error.code === "23505"
      ? "This subject is already in the selected exam class."
      : "Exam subject could not be added. Refresh and try again." };
  }
  if (!data) {
    console.error("Exam subject mapping RPC returned no record identifier.");
    return { error: "Exam subject could not be added. Refresh and try again." };
  }
  revalidatePath(`/exams/${parsed.data.examId}`);
  revalidatePath("/exams");
  revalidatePath("/setup");
  return { success: "Subject added to this class's exam and school class-subject setup." };
}

export async function removeExamSubject(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const id = String(formData.get("id") ?? ""); const examId = String(formData.get("examId") ?? ""); if (!id) return { error: "A subject is required." };
  const { supabase, schoolId } = await requireExamContext("manage");
  const { data: exam, error: examError } = await supabase.from("exams").select("status").eq("id", examId).eq("school_id", schoolId).maybeSingle();
  if (examError) {
    console.error("Exam status could not be checked before removing a subject.", examError);
    return { error: "Exam status could not be verified. Refresh and try again." };
  }
  if (!exam || exam.status !== "draft") return { error: "Subjects can only be changed before section marking starts." };
  const { data: sectionWorkflows, error: workflowsError } = await supabase.from("exam_section_workflows")
    .select("section_id").eq("exam_id", examId).eq("school_id", schoolId).limit(1);
  if (workflowsError) {
    console.error("Exam section progress could not be checked before removing a subject.", workflowsError);
    return { error: "Exam section progress could not be verified. Refresh and try again." };
  }
  if (sectionWorkflows?.length) return { error: "Exam subjects are locked after the first section is submitted." };
  const { data: subject, error: subjectError } = await supabase.from("exam_subjects").select("id")
    .eq("id", id).eq("exam_id", examId).eq("school_id", schoolId).maybeSingle();
  if (subjectError) {
    console.error("Exam subject could not be verified before removal.", subjectError);
    return { error: "Exam subject could not be verified. Refresh and try again." };
  }
  if (!subject) return { error: "Subject was not found." };
  const { error } = await supabase.from("exam_subjects").delete().eq("id", id).eq("exam_id", examId).eq("school_id", schoolId);
  if (error) return { error: "Exam subject could not be removed. Check for existing records." }; revalidatePath(`/exams/${examId}`); revalidatePath("/exams"); return { success: "Exam subject removed." };
}

export async function saveExamSchedule(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const parsed = examScheduleSchema.safeParse(values(formData)); if (!parsed.success) return { error: "Complete all required exam schedule fields." };
  const examId = parsed.data.examId;
  const { supabase, schoolId } = await requireExamContext("manage");
  const [
    { data: exam, error: examError },
    { data: subject, error: subjectError },
    { data: section, error: sectionError },
    { data: term, error: termError },
    { data: examiner, error: examinerError },
  ] = await Promise.all([
    supabase.from("exams").select("academic_session_id,starts_on,ends_on,status")
      .eq("id", examId).eq("school_id", schoolId).maybeSingle(),
    supabase.from("exam_subjects").select("class_id,subject_id").eq("id", parsed.data.examSubjectId)
      .eq("exam_id", examId).eq("school_id", schoolId).maybeSingle(),
    supabase.from("sections").select("class_id").eq("id", parsed.data.sectionId)
      .eq("school_id", schoolId).maybeSingle(),
    supabase.from("academic_terms").select("academic_session_id,starts_on,ends_on")
      .eq("id", parsed.data.academicTermId).eq("school_id", schoolId).maybeSingle(),
    supabase.from("teachers").select("id").eq("id", parsed.data.examinerTeacherId)
      .eq("school_id", schoolId).eq("employment_status", "active").eq("is_active", true).is("deleted_at", null).maybeSingle(),
  ]);
  if (examError || subjectError || sectionError || termError || examinerError) {
    console.error("Exam schedule details could not be verified.", examError ?? subjectError ?? sectionError ?? termError ?? examinerError);
    return { error: "The selected exam subject and section could not be verified. Refresh and try again." };
  }
  if (!exam || !subject || !section || !term || !examiner || exam.status !== "draft") {
    return { error: "Choose an exam still being planned, subject, section, term, and examiner from this school." };
  }
  if (subject.class_id !== section.class_id) {
    return { error: "Choose a section that belongs to the selected exam subject's class." };
  }
  if (term.academic_session_id !== exam.academic_session_id) {
    return { error: "Choose an academic term from the exam's academic session." };
  }
  if (parsed.data.scheduledOn < exam.starts_on || parsed.data.scheduledOn > exam.ends_on
    || parsed.data.scheduledOn < term.starts_on || parsed.data.scheduledOn > term.ends_on) {
    return { error: "The exam date must be within both the exam and academic-term dates." };
  }
  const { error } = await supabase.from("exam_schedules").insert({
    school_id: schoolId,
    exam_subject_id: parsed.data.examSubjectId,
    section_id: parsed.data.sectionId,
    academic_term_id: parsed.data.academicTermId,
    examiner_teacher_id: parsed.data.examinerTeacherId,
    scheduled_on: parsed.data.scheduledOn,
    starts_at: parsed.data.startsAt,
    ends_at: parsed.data.endsAt,
    room: parsed.data.room || null,
  });
  if (error) {
    if (error.code === "23P01") return { error: "This examiner is already assigned to another exam at that time." };
    if (error.message.includes("submitted for marking")) return { error: error.message };
    return { error: error.code === "23505" ? "This subject is already scheduled for this section and date." : "Exam schedule could not be added." };
  }
  revalidatePath(`/exams/${examId}`);
  revalidatePath("/exams");
  revalidatePath("/exams/timetable");
  return { success: "Exam schedule added." };
}

export async function removeExamSchedule(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const id = String(formData.get("id") ?? ""); const examId = String(formData.get("examId") ?? ""); if (!id) return { error: "A schedule is required." };
  const { supabase, schoolId } = await requireExamContext("manage");
  const { data: schedule, error: scheduleError } = await supabase.from("exam_schedules")
    .select("id,section_id,exam_subjects(exam_id)").eq("id", id).eq("school_id", schoolId).maybeSingle();
  if (scheduleError) {
    console.error("Exam schedule could not be verified before removal.", scheduleError);
    return { error: "Exam schedule could not be verified. Refresh and try again." };
  }
  const examSubject = Array.isArray(schedule?.exam_subjects) ? schedule.exam_subjects[0] : schedule?.exam_subjects;
  if (!schedule || examSubject?.exam_id !== examId) return { error: "Schedule was not found." };
  const { data: exam, error: examError } = await supabase.from("exams").select("status").eq("id", examId).eq("school_id", schoolId).maybeSingle();
  if (examError) {
    console.error("Exam status could not be checked before removing a schedule.", examError);
    return { error: "Exam status could not be verified. Refresh and try again." };
  }
  if (!exam || exam.status !== "draft") return { error: "Schedules can only be changed while the exam is being planned." };
  const { error } = await supabase.from("exam_schedules").delete().eq("id", id).eq("school_id", schoolId);
  if (error) {
    if (error.message.includes("submitted for marking")) return { error: error.message };
    return { error: "Exam schedule could not be removed." };
  }
  revalidatePath(`/exams/${examId}`); revalidatePath("/exams"); revalidatePath("/exams/timetable"); return { success: "Exam schedule removed." };
}

export async function submitMarks(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const rawRecords = String(formData.get("records") ?? "[]"); let records: unknown;
  try { records = JSON.parse(rawRecords); } catch { return { error: "Marks records are invalid." }; }
  const parsed = marksSubmissionSchema.safeParse({
    examSubjectId: formData.get("examSubjectId"),
    sectionId: formData.get("sectionId"),
    records,
  });
  if (!parsed.success) return { error: "Complete all required marks fields." };
  const examId = String(formData.get("examId") ?? "");
  const { supabase, schoolId, user } = await requireGradingContext("manage");
  const { data: subject, error: subjectError } = await supabase.from("exam_subjects").select("id,exam_id,maximum_marks,class_id,exams(academic_session_id,status,grading_scale_id)").eq("id", parsed.data.examSubjectId).eq("school_id", schoolId).maybeSingle();
  const exam = Array.isArray(subject?.exams) ? subject.exams[0] : subject?.exams;
  if (subjectError) {
    console.error("Exam subject could not be loaded for marks entry.", subjectError);
    return { error: "Exam subject could not be verified. Refresh and try again." };
  }
  if (!subject || !exam) return { error: "Exam subject was not found." };
  if (String(subject.exam_id) !== examId) return { error: "Exam subject does not belong to this exam." };
  if (parsed.data.records.some((record) => record.obtainedMarks > Number(subject.maximum_marks))) {
    return { error: `Obtained marks cannot exceed ${subject.maximum_marks}.` };
  }
  const scaleId = exam.grading_scale_id ? String(exam.grading_scale_id) : "";
  const { data: gradeBoundaries, error: boundariesError } = scaleId
    ? await supabase.from("grade_boundaries").select("grade,min_percentage,max_percentage").eq("grading_scale_id", scaleId)
    : { data: [], error: null };
  if (boundariesError) {
    console.error("Grading scale boundaries could not be loaded.", boundariesError);
    return { error: "Grading scale could not be verified. Refresh and try again." };
  }
  const studentIds = parsed.data.records.map((record) => record.studentId);
  const { data: section, error: sectionError } = await supabase.from("sections").select("id,class_id")
    .eq("id", parsed.data.sectionId).eq("school_id", schoolId).eq("status", "active").maybeSingle();
  if (sectionError) {
    console.error("Exam marking section could not be verified.", sectionError);
    return { error: "Selected section could not be verified. Refresh and try again." };
  }
  if (!section || section.class_id !== subject.class_id) return { error: "Choose an active section in this exam subject's class." };
  const [
    { data: sectionWorkflow, error: workflowError },
    { data: classSubjects, error: classSubjectsError },
    { data: sectionSchedules, error: sectionSchedulesError },
  ] = await Promise.all([
    supabase.from("exam_section_workflows").select("status").eq("exam_id", examId)
      .eq("school_id", schoolId).eq("section_id", section.id).maybeSingle(),
    supabase.from("exam_subjects").select("id").eq("exam_id", examId).eq("school_id", schoolId).eq("class_id", subject.class_id),
    supabase.from("exam_schedules").select("exam_subject_id").eq("school_id", schoolId).eq("section_id", section.id),
  ]);
  if (workflowError || classSubjectsError || sectionSchedulesError) {
    console.error("Section paper coverage could not be verified for marks entry.", workflowError ?? classSubjectsError ?? sectionSchedulesError);
    return { error: "Section exam coverage could not be verified. Refresh and try again." };
  }
  if (sectionWorkflow?.status !== "submitted") return { error: "Marks can only be entered while this section is submitted for marking." };
  const scheduledSubjectIds = new Set((sectionSchedules ?? []).map((schedule) => schedule.exam_subject_id));
  if (!classSubjects?.length || classSubjects.some((classSubject) => !scheduledSubjectIds.has(classSubject.id))) {
    return { error: "Marks can only be entered for a section with every class exam subject scheduled." };
  }
  const { data: enrollments, error: enrollmentError } = await supabase.from("student_enrollments").select("student_id")
    .eq("school_id", schoolId).eq("class_id", subject.class_id).eq("section_id", section.id)
    .eq("academic_session_id", exam.academic_session_id).eq("status", "active").in("student_id", studentIds);
  if (enrollmentError) {
    console.error("Exam enrolments could not be verified for marks entry.", enrollmentError);
    return { error: "Student enrolments could not be verified. Refresh and try again." };
  }
  const validIds = new Set((enrollments ?? []).map((item) => item.student_id));
  if (parsed.data.records.some((record) => !validIds.has(record.studentId))) return { error: "Marks can only be saved for students enrolled in this section." };
  const maximumMarks = Number(subject.maximum_marks);
  const rows = parsed.data.records.map((record) => {
    const percentage = Math.round((record.obtainedMarks / maximumMarks) * 10000) / 100;
    const calculatedGrade = gradeBoundaries?.find((boundary) =>
      percentage >= Number(boundary.min_percentage) && percentage <= Number(boundary.max_percentage),
    )?.grade;
    return {
      school_id: schoolId,
      exam_subject_id: parsed.data.examSubjectId,
      student_id: record.studentId,
      obtained_marks: record.obtainedMarks,
      grade: record.grade || calculatedGrade || null,
      remarks: record.remarks || null,
      entered_by: user.id,
    };
  });
  const { error } = await supabase.from("marks").upsert(rows, { onConflict: "exam_subject_id,student_id" });
  if (error) {
    console.error("Exam marks could not be saved.", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      examId,
      examSubjectId: parsed.data.examSubjectId,
      sectionId: section.id,
      recordCount: rows.length,
    });
    if (error.message.includes("Exam marks require an active enrolment")) {
      return { error: "Marks can only be saved for students actively enrolled in this submitted section." };
    }
    if (error.message.includes("Obtained marks cannot exceed maximum marks")) {
      return { error: `Obtained marks cannot exceed ${subject.maximum_marks}.` };
    }
    if (error.message.includes("Published exam marks cannot be modified")) {
      return { error: "Marks for a published exam cannot be changed." };
    }
    if (error.code === "42501") return { error: "You do not have permission to save marks for this school." };
    return { error: `Marks could not be saved (database error ${error.code || "unknown"}). Please try again; if the problem continues, share this error code with your administrator.` };
  }
  revalidatePath(`/exams/${examId}`);
  revalidatePath("/exams");
  return { success: `Marks saved for ${rows.length} students.` };
}