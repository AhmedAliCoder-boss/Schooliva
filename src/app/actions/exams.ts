"use server";
import { revalidatePath } from "next/cache";
import { requireExamContext, requireGradingContext } from "@/lib/exams/context";
import { examScheduleSchema, examSchema, examSubjectSchema, examTypeSchema, gradeBoundarySchema, gradingScaleSchema, marksSubmissionSchema, type ExamFormState } from "@/lib/exams/schemas";
function values(formData: FormData) { return Object.fromEntries(formData.entries()); }

export async function createExam(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const parsed = examSchema.safeParse(values(formData)); if (!parsed.success) return { error: "Exam form complete nahi hai." };
  const { supabase, schoolId, user } = await requireExamContext("manage");
  const { error } = await supabase.from("exams").insert({ school_id: schoolId, exam_type_id: parsed.data.examTypeId, academic_session_id: parsed.data.academicSessionId, name: parsed.data.name, starts_on: parsed.data.startsOn, ends_on: parsed.data.endsOn, grading_scale_id: parsed.data.gradingScaleId || null, created_by: user.id });
  if (error) return { error: error.code === "23505" ? "Exam name already use ho raha hai." : "Exam create nahi ho saka." }; revalidatePath("/exams"); return { success: "Exam create ho gaya." };
}

const workflow: Record<string, string> = { draft: "submitted", submitted: "reviewed", reviewed: "published", published: "published" };

export async function changeExamStatus(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const id = String(formData.get("id") ?? ""); const { supabase, schoolId } = await requireExamContext("manage");
  const { data: exam } = await supabase.from("exams").select("status").eq("id", id).eq("school_id", schoolId).maybeSingle();
  if (!exam) return { error: "Exam nahi mila." };
  const next = workflow[String(exam.status)]; if (!next || next === String(exam.status)) return { error: "Exam workflow aage nahi badh sakta." };
  const { error } = await supabase.from("exams").update({ status: next }).eq("id", id).eq("school_id", schoolId);
  if (error) return { error: "Workflow transition invalid hai ya exam protected hai." }; revalidatePath("/exams"); revalidatePath(`/exams/${id}`); return { success: `Exam ${next} ho gaya.` };
}

export async function saveExamType(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const parsed = examTypeSchema.safeParse(values(formData)); if (!parsed.success) return { error: "Exam type form complete nahi hai." };
  const { supabase, schoolId } = await requireExamContext("manage");
  const { error } = await supabase.from("exam_types").insert({ school_id: schoolId, name: parsed.data.name, description: parsed.data.description || null });
  if (error) return { error: error.code === "23505" ? "Exam type already use ho raha hai." : "Exam type add nahi ho saka." }; revalidatePath("/exams"); return { success: "Exam type add ho gaya." };
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
  const { error } = await supabase.from("grade_boundaries").insert({ grading_scale_id: parsed.data.gradingScaleId, grade: parsed.data.grade, min_percentage: parsed.data.minPercentage, max_percentage: parsed.data.maxPercentage, grade_point: parsed.data.gradePoint || null, remark: parsed.data.remark || null });
  if (error) return { error: error.code === "23505" ? "Ye grade already is scale mein hai." : "Grade boundary add nahi hui." }; revalidatePath("/exams"); return { success: "Grade boundary add ho gayi." };
}

export async function saveExamSubject(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const parsed = examSubjectSchema.safeParse(values(formData)); if (!parsed.success) return { error: "Exam subject form complete nahi hai." };
  const { supabase, schoolId } = await requireExamContext("manage");
  const { error } = await supabase.from("exam_subjects").insert({ school_id: schoolId, exam_id: parsed.data.examId, class_id: parsed.data.classId, subject_id: parsed.data.subjectId, maximum_marks: parsed.data.maximumMarks, passing_marks: parsed.data.passingMarks || null });
  if (error) return { error: error.code === "23505" ? "Ye subject already is exam aur class mein hai." : "Exam subject add nahi hua." }; revalidatePath(`/exams/${parsed.data.examId}`); revalidatePath("/exams"); return { success: "Exam subject add ho gaya." };
}

export async function removeExamSubject(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const id = String(formData.get("id") ?? ""); const examId = String(formData.get("examId") ?? ""); if (!id) return { error: "Subject required hai." };
  const { supabase, schoolId } = await requireExamContext("manage");
  const { error } = await supabase.from("exam_subjects").delete().eq("id", id).eq("school_id", schoolId);
  if (error) return { error: "Exam subject remove nahi hua. Existing records check karein." }; revalidatePath(`/exams/${examId}`); revalidatePath("/exams"); return { success: "Exam subject remove ho gaya." };
}

export async function saveExamSchedule(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const parsed = examScheduleSchema.safeParse(values(formData)); if (!parsed.success) return { error: "Exam schedule form complete nahi hai." };
  const examId = String(formData.get("examId") ?? "");
  const { supabase, schoolId } = await requireExamContext("manage");
  const { error } = await supabase.from("exam_schedules").insert({ school_id: schoolId, exam_subject_id: parsed.data.examSubjectId, section_id: parsed.data.sectionId, scheduled_on: parsed.data.scheduledOn, starts_at: parsed.data.startsAt, ends_at: parsed.data.endsAt, room: parsed.data.room || null });
  if (error) return { error: error.code === "23505" ? "Ye subject is section aur date par already schedule hai." : "Exam schedule add nahi hua." }; revalidatePath(`/exams/${examId}`); revalidatePath("/exams"); return { success: "Exam schedule add ho gaya." };
}

export async function removeExamSchedule(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const id = String(formData.get("id") ?? ""); const examId = String(formData.get("examId") ?? ""); if (!id) return { error: "Schedule required hai." };
  const { supabase, schoolId } = await requireExamContext("manage");
  const { error } = await supabase.from("exam_schedules").delete().eq("id", id).eq("school_id", schoolId);
  if (error) return { error: "Exam schedule remove nahi hua." }; revalidatePath(`/exams/${examId}`); revalidatePath("/exams"); return { success: "Exam schedule remove ho gaya." };
}

export async function submitMarks(_: ExamFormState | undefined, formData: FormData): Promise<ExamFormState> {
  const rawRecords = String(formData.get("records") ?? "[]"); let records: unknown;
  try { records = JSON.parse(rawRecords); } catch { return { error: "Marks records invalid hain." }; }
  const parsed = marksSubmissionSchema.safeParse({ examSubjectId: formData.get("examSubjectId"), records });
  if (!parsed.success) return { error: "Marks form complete nahi hai." };
  const examId = String(formData.get("examId") ?? "");
  const { supabase, schoolId, user } = await requireGradingContext("manage");
  const { data: subject } = await supabase.from("exam_subjects").select("id,maximum_marks,class_id,exams(academic_session_id,status)").eq("id", parsed.data.examSubjectId).eq("school_id", schoolId).maybeSingle();
  const exam = Array.isArray(subject?.exams) ? subject.exams[0] : subject?.exams;
  if (!subject || !exam) return { error: "Exam subject nahi mila." };
  if (String(exam.status) === "published") return { error: "Published exam ke marks change nahi ho sakte." };
  const studentIds = parsed.data.records.map((record) => record.studentId);
  const { data: enrollments } = await supabase.from("student_enrollments").select("student_id").eq("school_id", schoolId).eq("class_id", subject.class_id).eq("academic_session_id", exam.academic_session_id).eq("status", "active").in("student_id", studentIds);
  const validIds = new Set((enrollments ?? []).map((item) => item.student_id));
  if (parsed.data.records.some((record) => !validIds.has(record.studentId))) return { error: "Is class ke enrolled students ke liye hi marks save ho sakte hain." };
  const rows = parsed.data.records.map((record) => ({ school_id: schoolId, exam_subject_id: parsed.data.examSubjectId, student_id: record.studentId, obtained_marks: record.obtainedMarks, grade: record.grade || null, remarks: record.remarks || null, entered_by: user.id }));
  const { error } = await supabase.from("marks").upsert(rows, { onConflict: "exam_subject_id,student_id" });
  if (error) return { error: "Marks save nahi ho sake." }; revalidatePath(`/exams/${examId}`); revalidatePath("/exams"); return { success: `${rows.length} students ke marks save ho gaye.` };
}