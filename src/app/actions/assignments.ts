"use server";

import { revalidatePath } from "next/cache";
import { requireAssignmentContext } from "@/lib/assignments/context";
import { assignmentReviewSchema, assignmentSchema, assignmentStatusSchema, submissionSchema, type AssignmentFormState } from "@/lib/assignments/schemas";

function values(formData: FormData) { return Object.fromEntries(formData.entries()); }

export async function createAssignment(_: AssignmentFormState | undefined, formData: FormData): Promise<AssignmentFormState> {
  const parsed = assignmentSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Assignment form is invalid." };
  const { supabase, schoolId } = await requireAssignmentContext("manage");
  const [
    { data: section, error: sectionError },
    { data: teacher, error: teacherError },
    { data: session, error: sessionError },
    { data: subject, error: subjectError },
    { data: classRow, error: classError },
  ] = await Promise.all([
    supabase.from("sections").select("id,class_id,status").eq("id", parsed.data.sectionId).eq("school_id", schoolId).maybeSingle(),
    supabase.from("teachers").select("id").eq("id", parsed.data.teacherId).eq("school_id", schoolId)
      .eq("is_active", true).is("deleted_at", null).maybeSingle(),
    supabase.from("academic_sessions").select("id").eq("id", parsed.data.academicSessionId)
      .eq("school_id", schoolId).maybeSingle(),
    supabase.from("subjects").select("id").eq("id", parsed.data.subjectId)
      .eq("school_id", schoolId).eq("status", "active").maybeSingle(),
    supabase.from("classes").select("id").eq("id", parsed.data.classId)
      .eq("school_id", schoolId).eq("status", "active").maybeSingle(),
  ]);
  const lookupError = sectionError ?? teacherError ?? sessionError ?? subjectError ?? classError;
  if (lookupError) {
    console.error("Assignment details could not be verified before creation.", lookupError);
    return { error: "Assignment details could not be verified. Refresh and try again." };
  }
  if (!classRow || !section || section.class_id !== parsed.data.classId || section.status !== "active") {
    return { error: "Choose an active section belonging to the selected class." };
  }
  if (!teacher || !session || !subject) {
    return { error: "Choose an active teacher, academic session, and subject from this school." };
  }
  const { error } = await supabase.from("assignments").insert({
    school_id: schoolId,
    academic_session_id: parsed.data.academicSessionId,
    class_id: parsed.data.classId,
    section_id: parsed.data.sectionId,
    subject_id: parsed.data.subjectId,
    teacher_id: parsed.data.teacherId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    issue_date: parsed.data.issueDate,
    due_date: parsed.data.dueDate,
    max_marks: parsed.data.maxMarks ?? null,
  });
  if (error) return { error: error.code === "23505" ? "Assignment already exists." : "Assignment could not be created." };
  revalidatePath("/assignments"); return { success: "Assignment created." };
}

export async function changeAssignmentStatus(_: AssignmentFormState | undefined, formData: FormData): Promise<AssignmentFormState> {
  const parsed = assignmentStatusSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Assignment status is invalid." };
  const { supabase, schoolId } = await requireAssignmentContext("manage");
  const { data: assignment, error } = await supabase.from("assignments").update({
    status: parsed.data.status,
    updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.assignmentId).eq("school_id", schoolId).select("id").maybeSingle();
  if (error) {
    console.error("Assignment status could not be changed.", error);
    return { error: "Assignment status could not be changed. Refresh and try again." };
  }
  if (!assignment) return { error: "The assignment could not be found." };
  revalidatePath("/assignments");
  return { success: parsed.data.status === "closed" ? "Submissions are now closed." : "Submissions have reopened." };
}

export async function submitAssignment(_: AssignmentFormState | undefined, formData: FormData): Promise<AssignmentFormState> {
  const parsed = submissionSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Submission is invalid." };
  const { supabase, schoolId, user } = await requireAssignmentContext("submit");
  const [
    { data: student, error: studentError },
    { data: assignment, error: assignmentError },
  ] = await Promise.all([
    supabase.from("students").select("id").eq("school_id", schoolId).eq("profile_id", user.id).maybeSingle(),
    supabase.from("assignments").select("id,class_id,section_id,academic_session_id,issue_date,due_date,status")
      .eq("id", parsed.data.assignmentId).eq("school_id", schoolId).maybeSingle(),
  ]);
  if (studentError || assignmentError) {
    console.error("Assignment submission access could not be verified.", studentError ?? assignmentError);
    return { error: "Assignment submission could not be verified. Refresh and try again." };
  }
  if (!student) return { error: "Sign in with the student account linked to your school record to submit this assignment." };
  if (!assignment || assignment.status !== "open") return { error: "This assignment is not accepting submissions." };
  const today = new Date().toISOString().slice(0, 10);
  if (today < assignment.issue_date) return { error: "This assignment is not open for submissions yet." };
  const { data: enrollment, error: enrollmentError } = await supabase.from("student_enrollments").select("student_id")
    .eq("school_id", schoolId).eq("student_id", student.id).eq("academic_session_id", assignment.academic_session_id)
    .eq("class_id", assignment.class_id).eq("section_id", assignment.section_id).eq("status", "active").maybeSingle();
  if (enrollmentError) {
    console.error("Student assignment eligibility could not be verified.", enrollmentError);
    return { error: "Your enrollment could not be verified. Refresh and try again." };
  }
  if (!enrollment) return { error: "You are not enrolled in the class and section assigned to this work." };
  const { data: previousSubmission, error: previousSubmissionError } = await supabase.from("assignment_submissions")
    .select("id,status").eq("school_id", schoolId).eq("assignment_id", assignment.id)
    .eq("student_id", student.id).maybeSingle();
  if (previousSubmissionError) {
    console.error("Existing assignment submission could not be checked.", previousSubmissionError);
    return { error: "Your existing submission could not be checked. Refresh and try again." };
  }
  if (previousSubmission && ["reviewed", "graded"].includes(previousSubmission.status)) {
    return { error: "This submission has already been reviewed and can no longer be changed." };
  }

  const { error } = await supabase.from("assignment_submissions").upsert({
    school_id: schoolId,
    assignment_id: parsed.data.assignmentId,
    student_id: student.id,
    content: parsed.data.content || null,
    status: today > assignment.due_date ? "late" : "submitted",
    submitted_at: new Date().toISOString(),
  }, { onConflict: "assignment_id,student_id" });
  if (error) return { error: "Submission could not be saved." };
  revalidatePath("/assignments"); return { success: "Assignment submitted." };
}

export async function gradeAssignmentSubmission(_: AssignmentFormState | undefined, formData: FormData): Promise<AssignmentFormState> {
  const parsed = assignmentReviewSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Grade form is invalid." };
  const { supabase, schoolId } = await requireAssignmentContext("review");
  const { data: submission, error: submissionError } = await supabase.from("assignment_submissions")
    .select("id,status,assignments(max_marks)").eq("id", parsed.data.submissionId).eq("school_id", schoolId).maybeSingle();
  if (submissionError) {
    console.error("Assignment submission could not be loaded for review.", submissionError);
    return { error: "The submission could not be loaded for review. Refresh and try again." };
  }
  if (!submission || !["submitted", "late"].includes(submission.status)) {
    return { error: "This submission is no longer awaiting review." };
  }
  const assignmentRelation = Array.isArray(submission.assignments) ? submission.assignments[0] : submission.assignments;
  if (parsed.data.marks !== "" && assignmentRelation?.max_marks != null
    && parsed.data.marks > Number(assignmentRelation.max_marks)) {
    return { error: `Marks cannot exceed ${assignmentRelation.max_marks}.` };
  }
  const { data: updatedSubmission, error } = await supabase.from("assignment_submissions").update({
    marks: parsed.data.marks === "" ? null : parsed.data.marks,
    feedback: parsed.data.feedback || null,
    status: "graded",
    updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.submissionId).eq("school_id", schoolId).in("status", ["submitted", "late"]).select("id").maybeSingle();
  if (error) {
    console.error("Assignment review could not be updated.", error);
    return { error: "Assignment review could not be updated. Refresh and try again." };
  }
  if (!updatedSubmission) return { error: "This submission has already been reviewed." };
  revalidatePath("/assignments"); return { success: "Submission reviewed." };
}
