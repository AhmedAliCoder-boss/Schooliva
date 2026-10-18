"use server";

import { revalidatePath } from "next/cache";

import { requireCurriculumContext } from "@/lib/curriculum/context";
import {
  academicPlanArchiveSchema,
  academicPlanProgressSchema,
  academicPlanSchema,
  type AcademicPlanFormState,
} from "@/lib/curriculum/planning-schemas";

function formValues(formData: FormData) {
  const values = Object.fromEntries(formData.entries());
  const [classId = "", subjectId = ""] = String(values.curriculumKey ?? "").split("|");
  return { ...values, classId, subjectId };
}

function revalidatePlanning() {
  revalidatePath("/academic-planning");
  revalidatePath("/curriculum");
  revalidatePath("/dashboard");
}

export async function saveAcademicPlan(
  _previousState: AcademicPlanFormState | undefined,
  formData: FormData,
): Promise<AcademicPlanFormState> {
  const parsed = academicPlanSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review the academic plan details." };

  const { supabase, schoolId } = await requireCurriculumContext("manage");
  const plan = parsed.data;
  const [
    { data: session, error: sessionError },
    { data: mapping, error: mappingError },
    { data: term, error: termError },
    { data: teacherAssignment, error: teacherError },
    { data: teacher, error: teacherProfileError },
    { data: existingPlan, error: existingPlanError },
  ] = await Promise.all([
    supabase.from("academic_sessions").select("id,starts_on,ends_on").eq("id", plan.academicSessionId).eq("school_id", schoolId).maybeSingle(),
    supabase.from("curriculum_subject_assignments").select("id").eq("school_id", schoolId).eq("academic_session_id", plan.academicSessionId).eq("class_id", plan.classId).eq("subject_id", plan.subjectId).eq("status", "active").maybeSingle(),
    plan.termId
      ? supabase.from("academic_terms").select("id,starts_on,ends_on").eq("id", plan.termId).eq("academic_session_id", plan.academicSessionId).eq("school_id", schoolId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    plan.teacherId
      ? supabase.from("teacher_assignments").select("id").eq("school_id", schoolId).eq("academic_session_id", plan.academicSessionId).eq("teacher_id", plan.teacherId).eq("subject_id", plan.subjectId).eq("assignment_type", "subject").or(`class_id.is.null,class_id.eq.${plan.classId}`).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    plan.teacherId
      ? supabase.from("teachers").select("id").eq("id", plan.teacherId).eq("school_id", schoolId).eq("employment_status", "active").eq("is_active", true).is("deleted_at", null).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    plan.id
      ? supabase.from("academic_plan_units").select("id,completed_lessons,status").eq("id", plan.id).eq("school_id", schoolId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (sessionError || mappingError || termError || teacherError || teacherProfileError || existingPlanError) {
    console.error("Academic plan prerequisites could not be verified.", sessionError ?? mappingError ?? termError ?? teacherError ?? teacherProfileError ?? existingPlanError);
    return { error: "Academic planning data could not be verified. Refresh and try again." };
  }
  if (!session || !mapping) return { error: "Choose a class and subject mapped to this academic session." };
  if (plan.termId && !term) return { error: "Choose a term from the selected academic session." };
  if (plan.plannedStartDate < session.starts_on || plan.plannedEndDate > session.ends_on) {
    return { error: "The planned dates must fall within the academic session." };
  }
  if (term && (plan.plannedStartDate < term.starts_on || plan.plannedEndDate > term.ends_on)) {
    return { error: "The planned dates must fall within the selected term." };
  }
  if (plan.teacherId && (!teacherAssignment || !teacher)) {
    return { error: "Choose a teacher assigned to this subject and class for the selected session." };
  }
  if (plan.id && !existingPlan) return { error: "This academic plan could not be found in the active school." };
  if (existingPlan && plan.plannedLessons < Number(existingPlan.completed_lessons)) {
    return { error: "Planned lessons cannot be fewer than the lessons already completed." };
  }
  if (plan.status === "planned" && existingPlan && Number(existingPlan.completed_lessons) > 0 && existingPlan.status === "draft") {
    return { error: "A plan with completed lessons cannot be moved back to planned." };
  }
  const completedLessons = Number(existingPlan?.completed_lessons ?? 0);
  const status = !existingPlan || existingPlan.status === "draft" || existingPlan.status === "planned"
    ? plan.status
    : completedLessons === plan.plannedLessons ? "completed" : "in_progress";

  const payload = {
    academic_session_id: plan.academicSessionId,
    term_id: plan.termId || null,
    class_id: plan.classId,
    subject_id: plan.subjectId,
    teacher_id: plan.teacherId || null,
    unit_number: plan.unitNumber,
    title: plan.title,
    learning_objectives: plan.learningObjectives,
    key_concepts: plan.keyConcepts || null,
    planned_lessons: plan.plannedLessons,
    planned_start_date: plan.plannedStartDate,
    planned_end_date: plan.plannedEndDate,
    assessment_plan: plan.assessmentPlan,
    learning_resources: plan.learningResources || null,
    status,
  };
  const { data, error } = plan.id
    ? await supabase.from("academic_plan_units").update(payload).eq("id", plan.id).eq("school_id", schoolId).select("id").maybeSingle()
    : await supabase.from("academic_plan_units").insert({ school_id: schoolId, ...payload }).select("id").maybeSingle();

  if (error) {
    console.error("Academic unit plan could not be saved.", error);
    return { error: error.code === "23505" ? "This unit number is already used for that class, subject, and session." : "Academic plan could not be saved." };
  }
  if (!data) return { error: "No plan was changed. Refresh and try again." };

  revalidatePlanning();
  return { success: plan.id ? "Academic plan updated." : "Unit added to the academic plan." };
}

export async function updateAcademicPlanProgress(
  _previousState: AcademicPlanFormState | undefined,
  formData: FormData,
): Promise<AcademicPlanFormState> {
  const parsed = academicPlanProgressSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review the lesson progress." };

  const { supabase, schoolId } = await requireCurriculumContext("manage");
  const { data: plan, error: planError } = await supabase.from("academic_plan_units")
    .select("planned_lessons,status").eq("id", parsed.data.id).eq("school_id", schoolId).maybeSingle();
  if (planError || !plan) {
    console.error("Academic plan could not be loaded for progress update.", planError);
    return { error: "This academic plan could not be found." };
  }
  if (plan.status === "archived") return { error: "Restore this archived plan before changing its progress." };
  if (parsed.data.completedLessons > plan.planned_lessons) {
    return { error: "Completed lessons cannot exceed the planned lesson count." };
  }

  const status = parsed.data.completedLessons === plan.planned_lessons
    ? "completed"
    : parsed.data.completedLessons > 0 ? "in_progress" : "planned";
  const { data, error } = await supabase.from("academic_plan_units").update({
    completed_lessons: parsed.data.completedLessons,
    teacher_reflection: parsed.data.teacherReflection || null,
    status,
  }).eq("id", parsed.data.id).eq("school_id", schoolId).select("id").maybeSingle();
  if (error) {
    console.error("Academic plan progress could not be saved.", error);
    return { error: "Lesson progress could not be saved." };
  }
  if (!data) return { error: "This academic plan was removed before progress could be saved." };

  revalidatePlanning();
  return { success: status === "completed" ? "Unit marked complete." : "Lesson progress saved." };
}

export async function archiveAcademicPlan(
  _previousState: AcademicPlanFormState | undefined,
  formData: FormData,
): Promise<AcademicPlanFormState> {
  const parsed = academicPlanArchiveSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: "Choose a valid academic plan." };

  const { supabase, schoolId } = await requireCurriculumContext("manage");
  let status = "archived";
  if (parsed.data.operation === "restore") {
    const { data: plan, error: planError } = await supabase.from("academic_plan_units")
      .select("planned_lessons,completed_lessons")
      .eq("id", parsed.data.id).eq("school_id", schoolId).eq("status", "archived").maybeSingle();
    if (planError || !plan) {
      console.error("Archived academic plan could not be loaded.", planError);
      return { error: "This archived plan could not be found." };
    }
    status = plan.completed_lessons === plan.planned_lessons
      ? "completed"
      : plan.completed_lessons > 0 ? "in_progress" : "planned";
  }
  let mutation = supabase.from("academic_plan_units").update({ status })
    .eq("id", parsed.data.id).eq("school_id", schoolId);
  mutation = parsed.data.operation === "archive"
    ? mutation.neq("status", "archived")
    : mutation.eq("status", "archived");
  const { data, error } = await mutation.select("id").maybeSingle();
  if (error) {
    console.error("Academic plan could not be archived.", error);
    return { error: "Academic plan could not be archived." };
  }
  if (!data) return { error: "This academic plan was already archived or could not be found." };

  revalidatePlanning();
  return { success: parsed.data.operation === "archive" ? "Academic plan archived. Its teaching history is preserved." : "Academic plan restored." };
}
