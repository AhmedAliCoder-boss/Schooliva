"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStudentContext } from "@/lib/students/context";
import type { StudentFormState } from "@/lib/students/schemas";

const promotionSchema = z.object({
  sourceSessionId: z.string().uuid(),
  targetSessionId: z.string().uuid(),
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  sectionId: z.string().uuid(),
});

function relation<T>(value: unknown): T | null {
  return Array.isArray(value) ? ((value[0] ?? null) as T | null) : (value as T | null);
}

export async function promoteStudent(
  _: StudentFormState | undefined,
  formData: FormData,
): Promise<StudentFormState> {
  const parsed = promotionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Complete the promotion form." };

  const { supabase, schoolId, user } = await requireStudentContext("update");
  const { sourceSessionId, targetSessionId, studentId, classId, sectionId } = parsed.data;

  const { data: sourceSession, error: sourceError } = await supabase
    .from("academic_sessions")
    .select("id,name,starts_on,ends_on,status")
    .eq("id", sourceSessionId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (sourceError) {
    console.error("Could not load source academic session for promotion.", sourceError);
    return { error: "The academic session could not be verified." };
  }
  if (!sourceSession) return { error: "Academic session not found." };

  const [{ data: targetSessions, error: targetError }, { data: exams, error: examsError }, { data: roleRows, error: roleError }] = await Promise.all([
    supabase.from("academic_sessions").select("id,name,starts_on").eq("school_id", schoolId).gt("starts_on", sourceSession.ends_on).neq("status", "archived").order("starts_on").limit(1),
    supabase.from("exams").select("id,status").eq("school_id", schoolId).eq("academic_session_id", sourceSessionId),
    supabase.from("user_roles").select("roles(slug)").eq("school_id", schoolId).eq("user_id", user.id),
  ]);
  if (targetError || examsError || roleError) {
    console.error("Could not verify promotion eligibility.", { targetError, examsError, roleError });
    return { error: "Promotion eligibility could not be verified." };
  }
  if (sourceSession.status !== "completed") return { error: "The academic session must be marked as completed before promotion." };
  if (!exams?.length || exams.some((exam) => exam.status !== "published")) return { error: "All exam results for this session must be published first." };

  const nextSession = targetSessions?.[0];
  if (!nextSession || nextSession.id !== targetSessionId) return { error: "The next academic session is not available." };

  const roleSlugs = (roleRows ?? [])
    .map((row) => relation<{ slug: string }>(row.roles)?.slug)
    .filter((slug): slug is string => Boolean(slug));
  const isSchoolAdmin = roleSlugs.some((slug) => ["school_admin", "principal", "super_admin"].includes(slug));

  const { data: sourceEnrollment, error: enrollmentError } = await supabase
    .from("student_enrollments")
    .select("id,section_id,class_id")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("academic_session_id", sourceSessionId)
    .eq("status", "active")
    .maybeSingle();
  if (enrollmentError) {
    console.error("Could not load source enrollment for promotion.", enrollmentError);
    return { error: "The student's current enrollment could not be checked." };
  }
  if (!sourceEnrollment) return { error: "The student has no active enrollment in this session." };

  const { count: publishedMarkCount, error: publishedMarksError } = await supabase
    .from("published_exam_results")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("academic_session_id", sourceSessionId)
    .eq("student_id", studentId)
    .eq("class_id", sourceEnrollment.class_id);
  if (publishedMarksError) {
    console.error("Could not verify published student results.", publishedMarksError);
    return { error: "The student's published results could not be verified." };
  }
  if (!publishedMarkCount) return { error: "The student cannot be promoted without published marks." };

  if (!isSchoolAdmin) {
    if (!roleSlugs.includes("teacher")) return { error: "Only the class teacher or school administrator can promote students." };
    const { data: teacher, error: teacherError } = await supabase
      .from("teachers")
      .select("id")
      .eq("school_id", schoolId)
      .eq("profile_id", user.id)
      .eq("employment_status", "active")
      .maybeSingle();
    if (teacherError) {
      console.error("Could not verify the promoting class teacher.", teacherError);
      return { error: "Teacher access could not be verified." };
    }
    if (!teacher) return { error: "No active teacher profile was found." };
    const { data: sourceSection, error: sectionTeacherError } = await supabase
      .from("sections")
      .select("class_teacher_id")
      .eq("school_id", schoolId)
      .eq("id", sourceEnrollment.section_id)
      .maybeSingle();
    if (sectionTeacherError) {
      console.error("Could not verify class-teacher assignment.", sectionTeacherError);
      return { error: "The class teacher assignment could not be checked." };
    }
    if (sourceSection?.class_teacher_id !== teacher.id) return { error: "You can only promote students in your assigned class." };
  }

  const [{ data: targetClass, error: classError }, { data: targetSection, error: targetSectionError }, { data: existingEnrollment, error: existingError }] = await Promise.all([
    supabase.from("classes").select("id").eq("id", classId).eq("school_id", schoolId).eq("status", "active").maybeSingle(),
    supabase.from("sections").select("id,class_id").eq("id", sectionId).eq("school_id", schoolId).eq("status", "active").maybeSingle(),
    supabase.from("student_enrollments").select("id").eq("school_id", schoolId).eq("student_id", studentId).eq("academic_session_id", targetSessionId).maybeSingle(),
  ]);
  if (classError || targetSectionError || existingError) {
    console.error("Could not verify target enrollment selection.", { classError, targetSectionError, existingError });
    return { error: "The target class or section could not be verified." };
  }
  if (!targetClass || !targetSection || targetSection.class_id !== classId) return { error: "The selected section does not belong to this class." };
  if (existingEnrollment) return { error: "The student is already enrolled in the next session." };

  const { error: insertError } = await supabase.from("student_enrollments").insert({
    school_id: schoolId,
    student_id: studentId,
    academic_session_id: targetSessionId,
    class_id: classId,
    section_id: sectionId,
    enrolled_on: new Date().toISOString().slice(0, 10),
    status: "active",
  });
  if (insertError) {
    console.error("Student promotion enrollment could not be created.", insertError);
    return { error: insertError.code === "23505" ? "The student is already enrolled in the next session." : "The student could not be promoted." };
  }

  const { data: completedEnrollment, error: completionError } = await supabase
    .from("student_enrollments")
    .update({ status: "completed" })
    .eq("id", sourceEnrollment.id)
    .eq("school_id", schoolId)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (completionError || !completedEnrollment) {
    console.error("Previous enrollment could not be completed after promotion.", completionError);
    const { error: cleanupError } = await supabase
      .from("student_enrollments")
      .delete()
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .eq("academic_session_id", targetSessionId);
    if (cleanupError) {
      console.error("Could not remove the incomplete next-session enrollment.", cleanupError);
      return { error: "Promotion is incomplete. Contact your administrator." };
    }
    return { error: "The previous session enrollment could not be completed, so the promotion was canceled." };
  }

  revalidatePath("/students/promotions");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  return { success: `Student promoted to ${nextSession.name}.` };
}
