"use server";
import { revalidatePath } from "next/cache";
import { requireExamContext, requireGradingContext } from "@/lib/exams/context";
import { examScheduleSchema, examSchema, examSubjectSchema, examTypeSchema, gradeBoundarySchema, gradingScaleSchema, marksSubmissionSchema, type ExamFormState } from "@/lib/exams/schemas";
function values(formData: FormData) { return Object.fromEntries(formData.entries()); }

export async function createExam(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const parsed = examSchema.safeParse(values(formData)); if (!parsed.success) return { error: "Exam form complete nahi hai." };
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
  if (error) return { error: error.code === "23505" ? "Exam name already use ho raha hai." : "Exam create nahi ho saka." }; revalidatePath("/exams"); return { success: "Exam create ho gaya." };
}

const workflow: Record<string, string> = { draft: "submitted", submitted: "reviewed", reviewed: "published", published: "published" };

async function checkScheduleReadiness(supabase: Awaited<ReturnType<typeof requireExamContext>>["supabase"], schoolId: string, examId: string): Promise<string | null> {
  const { data: subjects, error: subjectsError } = await supabase.from("exam_subjects")
    .select("id,class_id").eq("exam_id", examId).eq("school_id", schoolId);
  if (subjectsError) {
    console.error("Exam subjects could not be checked before submission.", subjectsError);
    return "Exam subjects could not be verified. Refresh and try again.";
  }
  if (!subjects?.length) return "Add at least one exam subject before submitting this exam.";

  const classIds = [...new Set(subjects.map((subject) => subject.class_id))];
  const { data: sections, error: sectionsError } = await supabase.from("sections")
    .select("id,class_id").eq("school_id", schoolId).eq("status", "active").in("class_id", classIds);
  if (sectionsError) {
    console.error("Exam sections could not be checked before submission.", sectionsError);
    return "Class sections could not be verified. Refresh and try again.";
  }
  const sectionRows = sections ?? [];
  if (!sectionRows.length) return "Add an active section to each exam class before submitting.";

  const { data: schedules, error: schedulesError } = await supabase.from("exam_schedules")
    .select("exam_subject_id,section_id").eq("school_id", schoolId).in("exam_subject_id", subjects.map((subject) => subject.id));
  if (schedulesError) {
    console.error("Exam schedules could not be checked before submission.", schedulesError);
    return "Exam timetable could not be verified. Refresh and try again.";
  }
  const covered = new Set((schedules ?? []).map((schedule) => `${schedule.exam_subject_id}:${schedule.section_id}`));
  const missing = subjects.reduce((count, subject) => {
    const classSections = sectionRows.filter((section) => section.class_id === subject.class_id);
    if (!classSections.length) return count + 1;
    return count + classSections.filter((section) => !covered.has(`${subject.id}:${section.id}`)).length;
  }, 0);
  return missing ? `Schedule every exam subject for each active section before submitting (${missing} paper${missing === 1 ? "" : "s"} remaining).` : null;
}

async function checkMarksReadiness(supabase: Awaited<ReturnType<typeof requireExamContext>>["supabase"], schoolId: string, examId: string): Promise<string | null> {
  const [
    { data: exam, error: examError },
    { data: subjects, error: subjectsError },
  ] = await Promise.all([
    supabase.from("exams").select("academic_session_id").eq("id", examId).eq("school_id", schoolId).maybeSingle(),
    supabase.from("exam_subjects").select("id,class_id").eq("exam_id", examId).eq("school_id", schoolId),
  ]);
  if (examError || subjectsError) {
    console.error("Exam marks readiness could not be checked.", examError ?? subjectsError);
    return "Exam marks could not be verified. Refresh and try again.";
  }
  if (!exam || !subjects?.length) return "Add exam subjects before reviewing results.";

  const checks = await Promise.all(subjects.map(async (subject) => {
    const [
      { count: enrollmentCount, error: enrollmentError },
      { count: marksCount, error: marksError },
    ] = await Promise.all([
      supabase.from("student_enrollments").select("student_id", { count: "exact", head: true })
        .eq("school_id", schoolId).eq("academic_session_id", exam.academic_session_id)
        .eq("class_id", subject.class_id).eq("status", "active"),
      supabase.from("marks").select("id", { count: "exact", head: true })
        .eq("school_id", schoolId).eq("exam_subject_id", subject.id),
    ]);
    return { subjectId: subject.id, enrollmentCount, marksCount, enrollmentError, marksError };
  }));
  const failedCheck = checks.find((check) => check.enrollmentError || check.marksError);
  if (failedCheck) {
    console.error("Exam marks counts could not be checked.", failedCheck.enrollmentError ?? failedCheck.marksError);
    return "Student marks could not be verified. Refresh and try again.";
  }
  const missing = checks.reduce((sum, check) => sum + Math.max(0, (check.enrollmentCount ?? 0) - (check.marksCount ?? 0)), 0);
  return missing ? `Enter marks for every enrolled student before continuing (${missing} result${missing === 1 ? "" : "s"} remaining).` : null;
}

export async function changeExamStatus(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const id = String(formData.get("id") ?? ""); const { supabase, schoolId } = await requireExamContext("manage");
  if (!id) return { error: "Exam required hai." };
  const { data: exam, error: examError } = await supabase.from("exams").select("status").eq("id", id).eq("school_id", schoolId).maybeSingle();
  if (examError) {
    console.error("Exam status could not be loaded.", examError);
    return { error: "Exam status could not be verified. Refresh and try again." };
  }
  if (!exam) return { error: "Exam nahi mila." };
  const next = workflow[String(exam.status)]; if (!next || next === String(exam.status)) return { error: "Exam workflow aage nahi badh sakta." };
  const readinessError = exam.status === "draft"
    ? await checkScheduleReadiness(supabase, schoolId, id)
    : await checkMarksReadiness(supabase, schoolId, id);
  if (readinessError) return { error: readinessError };
  const { data: updated, error } = await supabase.from("exams").update({ status: next })
    .eq("id", id).eq("school_id", schoolId).eq("status", exam.status).select("id").maybeSingle();
  if (error) {
    console.error("Exam status transition failed.", error);
    return { error: "Exam workflow could not be updated. Refresh and try again." };
  }
  if (!updated) return { error: "Exam status changed in another request. Refresh and try again." };
  revalidatePath("/exams"); revalidatePath(`/exams/${id}`); revalidatePath("/exams/timetable"); return { success: `Exam ${next} ho gaya.` };
}

export async function saveExamType(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const parsed = examTypeSchema.safeParse(values(formData)); if (!parsed.success) return { error: "Exam type form complete nahi hai." };
  const { supabase, schoolId } = await requireExamContext("manage");
  const { error } = await supabase.from("exam_types").insert({ school_id: schoolId, name: parsed.data.name, description: parsed.data.description || null });
  if (error) {
    console.error("Exam type could not be added.", error);
    if (error.code === "23505") return { error: "Exam type already use ho raha hai." };
    if (error.code === "42501") return { error: "You do not have permission to add exam types for this school." };
    return { error: "Exam type add nahi ho saka. Refresh and try again." };
  }
  revalidatePath("/exams");
  return { success: "Exam type add ho gaya." };
}

export async function saveGradingScale(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const parsed = gradingScaleSchema.safeParse(values(formData)); if (!parsed.success) return { error: "Grading scale form complete nahi hai." };
  const { supabase, schoolId } = await requireGradingContext("manage");
  const { error } = await supabase.from("grading_scales").insert({ school_id: schoolId, name: parsed.data.name, description: parsed.data.description || null });
  if (error) return { error: error.code === "23505" ? "Grading scale already use ho raha hai." : "Grading scale add nahi hua." }; revalidatePath("/exams"); return { success: "Grading scale add ho gaya." };
}

export async function addGradeBoundary(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const parsed = gradeBoundarySchema.safeParse(values(formData)); if (!parsed.success) return { error: "Grade boundary form complete nahi hai." };
  const { supabase, schoolId } = await requireGradingContext("manage");
  const { data: scale } = await supabase.from("grading_scales").select("school_id").eq("id", parsed.data.gradingScaleId).maybeSingle();
  if (!scale || String(scale.school_id) !== schoolId) return { error: "Grading scale is school se nahi hai." };
  const { error } = await supabase.from("grade_boundaries").insert({ grading_scale_id: parsed.data.gradingScaleId, grade: parsed.data.grade, min_percentage: parsed.data.minPercentage, max_percentage: parsed.data.maxPercentage, grade_point: parsed.data.gradePoint === "" ? null : parsed.data.gradePoint, remark: parsed.data.remark || null });
  if (error) return { error: error.code === "23505" ? "Ye grade already is scale mein hai." : "Grade boundary add nahi hui." }; revalidatePath("/exams"); return { success: "Grade boundary add ho gayi." };
}

export async function saveExamSubject(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const parsed = examSubjectSchema.safeParse(values(formData)); if (!parsed.success) return { error: "Exam subject form complete nahi hai." };
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
  const id = String(formData.get("id") ?? ""); const examId = String(formData.get("examId") ?? ""); if (!id) return { error: "Subject required hai." };
  const { supabase, schoolId } = await requireExamContext("manage");
  const { data: exam, error: examError } = await supabase.from("exams").select("status").eq("id", examId).eq("school_id", schoolId).maybeSingle();
  if (examError) {
    console.error("Exam status could not be checked before removing a subject.", examError);
    return { error: "Exam status could not be verified. Refresh and try again." };
  }
  if (!exam || exam.status !== "draft") return { error: "Subjects can only be changed while the exam is a draft." };
  const { data: subject, error: subjectError } = await supabase.from("exam_subjects").select("id")
    .eq("id", id).eq("exam_id", examId).eq("school_id", schoolId).maybeSingle();
  if (subjectError) {
    console.error("Exam subject could not be verified before removal.", subjectError);
    return { error: "Exam subject could not be verified. Refresh and try again." };
  }
  if (!subject) return { error: "Subject nahi mila." };
  const { error } = await supabase.from("exam_subjects").delete().eq("id", id).eq("exam_id", examId).eq("school_id", schoolId);
  if (error) return { error: "Exam subject remove nahi hua. Existing records check karein." }; revalidatePath(`/exams/${examId}`); revalidatePath("/exams"); return { success: "Exam subject remove ho gaya." };
}

export async function saveExamSchedule(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const parsed = examScheduleSchema.safeParse(values(formData)); if (!parsed.success) return { error: "Exam schedule form complete nahi hai." };
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
    return { error: "Choose a draft exam, subject, section, term, and examiner from this school." };
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
  const { data: examinerAssignment, error: examinerAssignmentError } = await supabase.from("teacher_assignments")
    .select("id")
    .eq("school_id", schoolId)
    .eq("academic_session_id", exam.academic_session_id)
    .eq("teacher_id", parsed.data.examinerTeacherId)
    .eq("subject_id", subject.subject_id)
    .eq("assignment_type", "subject")
    .or(`class_id.is.null,class_id.eq.${subject.class_id}`)
    .limit(1)
    .maybeSingle();
  if (examinerAssignmentError) {
    console.error("Examiner subject assignment could not be verified.", examinerAssignmentError);
    return { error: "The examiner's subject assignment could not be verified. Refresh and try again." };
  }
  if (!examinerAssignment) {
    return { error: "Choose a teacher assigned to this subject for the exam's academic session and class." };
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
    return { error: error.code === "23505" ? "Ye subject is section aur date par already schedule hai." : "Exam schedule add nahi hua." };
  }
  revalidatePath(`/exams/${examId}`);
  revalidatePath("/exams");
  revalidatePath("/exams/timetable");
  return { success: "Exam schedule add ho gaya." };
}

export async function removeExamSchedule(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const id = String(formData.get("id") ?? ""); const examId = String(formData.get("examId") ?? ""); if (!id) return { error: "Schedule required hai." };
  const { supabase, schoolId } = await requireExamContext("manage");
  const { data: schedule, error: scheduleError } = await supabase.from("exam_schedules")
    .select("id,exam_subjects(exam_id)").eq("id", id).eq("school_id", schoolId).maybeSingle();
  if (scheduleError) {
    console.error("Exam schedule could not be verified before removal.", scheduleError);
    return { error: "Exam schedule could not be verified. Refresh and try again." };
  }
  const examSubject = Array.isArray(schedule?.exam_subjects) ? schedule.exam_subjects[0] : schedule?.exam_subjects;
  if (!schedule || examSubject?.exam_id !== examId) return { error: "Schedule nahi mila." };
  const { data: exam, error: examError } = await supabase.from("exams").select("status").eq("id", examId).eq("school_id", schoolId).maybeSingle();
  if (examError) {
    console.error("Exam status could not be checked before removing a schedule.", examError);
    return { error: "Exam status could not be verified. Refresh and try again." };
  }
  if (!exam || exam.status !== "draft") return { error: "Schedules can only be changed while the exam is a draft." };
  const { error } = await supabase.from("exam_schedules").delete().eq("id", id).eq("school_id", schoolId);
  if (error) return { error: "Exam schedule remove nahi hua." }; revalidatePath(`/exams/${examId}`); revalidatePath("/exams"); revalidatePath("/exams/timetable"); return { success: "Exam schedule remove ho gaya." };
}

export async function submitMarks(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const rawRecords = String(formData.get("records") ?? "[]"); let records: unknown;
  try { records = JSON.parse(rawRecords); } catch { return { error: "Marks records invalid hain." }; }
  const parsed = marksSubmissionSchema.safeParse({ examSubjectId: formData.get("examSubjectId"), records });
  if (!parsed.success) return { error: "Marks form complete nahi hai." };
  const examId = String(formData.get("examId") ?? "");
  const { supabase, schoolId, user } = await requireGradingContext("manage");
  const { data: subject, error: subjectError } = await supabase.from("exam_subjects").select("id,maximum_marks,class_id,exams(academic_session_id,status,grading_scale_id)").eq("id", parsed.data.examSubjectId).eq("school_id", schoolId).maybeSingle();
  const exam = Array.isArray(subject?.exams) ? subject.exams[0] : subject?.exams;
  if (subjectError) {
    console.error("Exam subject could not be loaded for marks entry.", subjectError);
    return { error: "Exam subject could not be verified. Refresh and try again." };
  }
  if (!subject || !exam) return { error: "Exam subject nahi mila." };
  if (String(exam.status) !== "submitted") return { error: "Marks can only be entered while the exam is submitted for marking." };
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
  const { data: enrollments, error: enrollmentError } = await supabase.from("student_enrollments").select("student_id").eq("school_id", schoolId).eq("class_id", subject.class_id).eq("academic_session_id", exam.academic_session_id).eq("status", "active").in("student_id", studentIds);
  if (enrollmentError) {
    console.error("Exam enrolments could not be verified for marks entry.", enrollmentError);
    return { error: "Student enrolments could not be verified. Refresh and try again." };
  }
  const validIds = new Set((enrollments ?? []).map((item) => item.student_id));
  if (parsed.data.records.some((record) => !validIds.has(record.studentId))) return { error: "Is class ke enrolled students ke liye hi marks save ho sakte hain." };
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
  if (error) return { error: "Marks save nahi ho sake." }; revalidatePath(`/exams/${examId}`); revalidatePath("/exams"); return { success: `${rows.length} students ke marks save ho gaye.` };
}