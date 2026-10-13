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
  if (!parsed.success) return { error: "Promotion form complete nahi hai." };

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
    return { error: "Academic session verify nahi ho saka." };
  }
  if (!sourceSession) return { error: "Academic session nahi mila." };

  const [{ data: targetSessions, error: targetError }, { data: exams, error: examsError }, { data: roleRows, error: roleError }] = await Promise.all([
    supabase.from("academic_sessions").select("id,name,starts_on").eq("school_id", schoolId).gt("starts_on", sourceSession.ends_on).neq("status", "archived").order("starts_on").limit(1),
    supabase.from("exams").select("id,status").eq("school_id", schoolId).eq("academic_session_id", sourceSessionId),
    supabase.from("user_roles").select("roles(slug)").eq("school_id", schoolId).eq("user_id", user.id),
  ]);
  if (targetError || examsError || roleError) {
    console.error("Could not verify promotion eligibility.", { targetError, examsError, roleError });
    return { error: "Promotion eligibility verify nahi ho saki." };
  }
  if (sourceSession.status !== "completed") return { error: "Promotion tab hogi jab academic session completed mark ho." };
  if (!exams?.length || exams.some((exam) => exam.status !== "published")) return { error: "Is session ke tamam exam results pehle publish hon." };

  const nextSession = targetSessions?.[0];
  if (!nextSession || nextSession.id !== targetSessionId) return { error: "Next academic session ab available nahi hai." };

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
    return { error: "Student ka current enrollment check nahi ho saka." };
  }
  if (!sourceEnrollment) return { error: "Student ka is session mein active enrollment nahi mila." };

  const { count: publishedMarkCount, error: publishedMarksError } = await supabase
    .from("published_exam_results")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("academic_session_id", sourceSessionId)
    .eq("student_id", studentId)
    .eq("class_id", sourceEnrollment.class_id);
  if (publishedMarksError) {
    console.error("Could not verify published student results.", publishedMarksError);
    return { error: "Student ke published results verify nahi ho sake." };
  }
  if (!publishedMarkCount) return { error: "Student ke published marks ke baghair promotion nahi ho sakti." };

  if (!isSchoolAdmin) {
    if (!roleSlugs.includes("teacher")) return { error: "Sirf class teacher ya school admin promotion kar sakta hai." };
    const { data: teacher, error: teacherError } = await supabase
      .from("teachers")
      .select("id")
      .eq("school_id", schoolId)
      .eq("profile_id", user.id)
      .eq("employment_status", "active")
      .maybeSingle();
    if (teacherError) {
      console.error("Could not verify the promoting class teacher.", teacherError);
      return { error: "Teacher access verify nahi ho saka." };
    }
    if (!teacher) return { error: "Active teacher profile nahi mila." };
    const { data: sourceSection, error: sectionTeacherError } = await supabase
      .from("sections")
      .select("class_teacher_id")
      .eq("school_id", schoolId)
      .eq("id", sourceEnrollment.section_id)
      .maybeSingle();
    if (sectionTeacherError) {
      console.error("Could not verify class-teacher assignment.", sectionTeacherError);
      return { error: "Class teacher assignment check nahi ho saki." };
    }
    if (sourceSection?.class_teacher_id !== teacher.id) return { error: "Aap sirf apni assigned class ke students promote kar sakte hain." };
  }

  const [{ data: targetClass, error: classError }, { data: targetSection, error: targetSectionError }, { data: existingEnrollment, error: existingError }] = await Promise.all([
    supabase.from("classes").select("id").eq("id", classId).eq("school_id", schoolId).eq("status", "active").maybeSingle(),
    supabase.from("sections").select("id,class_id").eq("id", sectionId).eq("school_id", schoolId).eq("status", "active").maybeSingle(),
    supabase.from("student_enrollments").select("id").eq("school_id", schoolId).eq("student_id", studentId).eq("academic_session_id", targetSessionId).maybeSingle(),
  ]);
  if (classError || targetSectionError || existingError) {
    console.error("Could not verify target enrollment selection.", { classError, targetSectionError, existingError });
    return { error: "Target class ya section verify nahi ho saka." };
  }
  if (!targetClass || !targetSection || targetSection.class_id !== classId) return { error: "Selected section is class ka nahi hai." };
  if (existingEnrollment) return { error: "Student next session mein pehle se enrolled hai." };

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
    return { error: insertError.code === "23505" ? "Student next session mein pehle se enrolled hai." : "Student promote nahi ho saka." };
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
      return { error: "Promotion adhuri hai; admin se contact karein." };
    }
    return { error: "Previous session enrollment complete nahi ho saki; promotion cancel kar di." };
  }

  revalidatePath("/students/promotions");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  return { success: `Student ${nextSession.name} ke liye promote ho gaya.` };
}
