export type ExamSubjectCoverage = { id: string; class_id: string };
export type ExamSectionCoverage = { id: string; class_id: string };
export type ExamScheduleCoverage = { exam_subject_id: string; section_id: string };
export type ExamSectionWorkflowStatus = "submitted" | "reviewed" | "published";

export function getExamWorkflowProgress(
  sectionIds: string[],
  workflows: Array<{ section_id: string; status: ExamSectionWorkflowStatus }>,
) {
  const statusBySection = new Map(workflows.map((workflow) => [workflow.section_id, workflow.status]));
  const statuses = sectionIds.map((sectionId) => statusBySection.get(sectionId) ?? "draft");
  const everyAtLeast = (allowed: string[]) => statuses.length > 0 && statuses.every((status) => allowed.includes(status));
  const status = everyAtLeast(["published"])
    ? "published"
    : everyAtLeast(["reviewed", "published"])
      ? "reviewed"
      : everyAtLeast(["submitted", "reviewed", "published"])
        ? "submitted"
        : "draft";
  return {
    status,
    total: statuses.length,
    submitted: statuses.filter((item) => item === "submitted").length,
    reviewed: statuses.filter((item) => item === "reviewed").length,
    published: statuses.filter((item) => item === "published").length,
    pending: statuses.filter((item) => item === "draft").length,
  };
}

export function getFullyScheduledSectionIds(
  subjects: ExamSubjectCoverage[],
  sections: ExamSectionCoverage[],
  schedules: ExamScheduleCoverage[],
) {
  const scheduled = new Set(schedules.map((schedule) => `${schedule.exam_subject_id}:${schedule.section_id}`));
  return new Set(sections
    .filter((section) => {
      const classSubjects = subjects.filter((subject) => subject.class_id === section.class_id);
      return classSubjects.length > 0
        && classSubjects.every((subject) => scheduled.has(`${subject.id}:${section.id}`));
    })
    .map((section) => section.id));
}
