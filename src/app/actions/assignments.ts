"use server";

import { revalidatePath } from "next/cache";
import { requireAssignmentContext } from "@/lib/assignments/context";
import { assignmentSchema, submissionSchema, type AssignmentFormState } from "@/lib/assignments/schemas";

function values(formData: FormData) { return Object.fromEntries(formData.entries()); }

export async function createAssignment(_: AssignmentFormState | undefined, formData: FormData): Promise<AssignmentFormState> {
  const parsed = assignmentSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Assignment form invalid hai." };
  const { supabase, schoolId, user } = await requireAssignmentContext("manage");
  const { error } = await supabase.from("assignments").insert({
    school_id: schoolId,
    academic_session_id: parsed.data.academicSessionId,
    class_id: parsed.data.classId,
    section_id: parsed.data.sectionId,
    subject_id: parsed.data.subjectId,
    teacher_id: user.id,
    title: parsed.data.title,
    description: parsed.data.description || null,
    issue_date: parsed.data.issueDate,
    due_date: parsed.data.dueDate,
    max_marks: parsed.data.maxMarks === "" ? null : parsed.data.maxMarks,
  });
  if (error) return { error: error.code === "23505" ? "Assignment already exists." : "Assignment create nahi ho saka." };
  revalidatePath("/assignments"); return { success: "Assignment create ho gaya." };
}

export async function submitAssignment(_: AssignmentFormState | undefined, formData: FormData): Promise<AssignmentFormState> {
  const parsed = submissionSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Submission invalid hai." };
  const { supabase, schoolId, user } = await requireAssignmentContext("submit");
  const { data: student } = await supabase.from("students").select("id").eq("school_id", schoolId).eq("profile_id", user.id).maybeSingle();
  if (!student) return { error: "Student record nahi mila." };

  const { error } = await supabase.from("assignment_submissions").upsert({
    school_id: schoolId,
    assignment_id: parsed.data.assignmentId,
    student_id: student.id,
    content: parsed.data.content || null,
    status: "submitted",
    marks: parsed.data.marks === "" ? null : parsed.data.marks,
    feedback: parsed.data.feedback || null,
    submitted_at: new Date().toISOString(),
  }, { onConflict: "assignment_id,student_id" });
  if (error) return { error: "Submission save nahi ho saka." };
  revalidatePath("/assignments"); return { success: "Assignment submit ho gaya." };
}

export async function gradeAssignment(_: AssignmentFormState | undefined, formData: FormData): Promise<AssignmentFormState> {
  const parsed = submissionSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Grade form invalid hai." };
  const { supabase, schoolId } = await requireAssignmentContext("review");
  const { error } = await supabase.from("assignment_submissions").update({
    marks: parsed.data.marks === "" ? null : parsed.data.marks,
    feedback: parsed.data.feedback || null,
    status: "graded",
    updated_at: new Date().toISOString(),
  }).eq("assignment_id", parsed.data.assignmentId).eq("school_id", schoolId).eq("status", "submitted");
  if (error) return { error: "Assignment review update nahi ho saka." };
  revalidatePath("/assignments"); return { success: "Submission review ho gaya." };
}
