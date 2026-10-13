import { describe, expect, it } from "vitest";

import { getExamWorkflowProgress, getFullyScheduledSectionIds } from "../../src/lib/exams/schedule-coverage";

describe("getFullyScheduledSectionIds", () => {
  const subjects = [
    { id: "math-a", class_id: "class-a" },
    { id: "science-a", class_id: "class-a" },
    { id: "math-b", class_id: "class-b" },
  ];
  const sections = [
    { id: "section-a1", class_id: "class-a" },
    { id: "section-a2", class_id: "class-a" },
    { id: "section-b1", class_id: "class-b" },
  ];

  it("allows marking only for a section with every class exam subject scheduled", () => {
    const schedules = [
      { exam_subject_id: "math-a", section_id: "section-a1" },
      { exam_subject_id: "science-a", section_id: "section-a1" },
      { exam_subject_id: "math-a", section_id: "section-a2" },
      { exam_subject_id: "math-b", section_id: "section-b1" },
    ];

    expect([...getFullyScheduledSectionIds(subjects, sections, schedules)])
      .toEqual(["section-a1", "section-b1"]);
  });

  describe("getExamWorkflowProgress", () => {
    it("keeps the overall exam pending until every active section reaches each stage", () => {
      const sectionIds = ["section-a", "section-b"];
      const submitted = [{ section_id: "section-a", status: "submitted" as const }];
      expect(getExamWorkflowProgress(sectionIds, submitted)).toMatchObject({
        status: "draft",
        submitted: 1,
        pending: 1,
      });
      expect(getExamWorkflowProgress(sectionIds, [
        ...submitted,
        { section_id: "section-b", status: "submitted" },
      ])).toMatchObject({ status: "submitted", submitted: 2, pending: 0 });
      expect(getExamWorkflowProgress(sectionIds, [
        { section_id: "section-a", status: "published" },
        { section_id: "section-b", status: "reviewed" },
      ])).toMatchObject({ status: "reviewed", published: 1, reviewed: 1 });
      expect(getExamWorkflowProgress(sectionIds, [
        { section_id: "section-a", status: "published" },
        { section_id: "section-b", status: "published" },
      ])).toMatchObject({ status: "published", published: 2 });
    });
  });

  it("does not include sections with partial schedules or no subjects", () => {
    expect([...getFullyScheduledSectionIds(subjects, sections, [
      { exam_subject_id: "math-a", section_id: "section-a1" },
    ])]).toEqual([]);
  });
});
