"use client";

import { useActionState, useState } from "react";

import { archiveAcademicPlan, saveAcademicPlan, updateAcademicPlanProgress } from "@/app/actions/academic-planning";
import { SubmitButton } from "@/components/auth/submit-button";
import type { AcademicPlanFormState } from "@/lib/curriculum/planning-schemas";

type Option = { id: string; name: string };
type CurriculumOption = {
  key: string;
  classId: string;
  subjectId: string;
  label: string;
  teachers: Array<{ id: string; name: string }>;
};
export type AcademicPlanRow = {
  id: string;
  academicSessionId: string;
  termId: string | null;
  classId: string;
  subjectId: string;
  teacherId: string | null;
  unitNumber: number;
  title: string;
  learningObjectives: string;
  keyConcepts: string;
  plannedLessons: number;
  completedLessons: number;
  plannedStartDate: string;
  plannedEndDate: string;
  assessmentPlan: string;
  learningResources: string;
  teacherReflection: string;
  status: string;
  className: string;
  subjectName: string;
  termName: string | null;
  teacherName: string | null;
};

function Feedback({ state }: { state: AcademicPlanFormState | undefined }) {
  return <>{state?.error && <p className="academic-planning-feedback academic-planning-feedback--error" role="alert">{state.error}</p>}{state?.success && <p className="academic-planning-feedback academic-planning-feedback--success" role="status">{state.success}</p>}</>;
}

function PlanFields({
  plan,
  sessionId,
  terms,
  curriculum,
}: {
  plan?: AcademicPlanRow;
  sessionId: string;
  terms: Option[];
  curriculum: CurriculumOption[];
}) {
  const initialMapping = plan ? `${plan.classId}|${plan.subjectId}` : "";
  const [mappingKey, setMappingKey] = useState(initialMapping);
  const mapping = curriculum.find((item) => item.key === mappingKey);
  return <>
    {plan && <input type="hidden" name="id" value={plan.id} />}
    <input type="hidden" name="academicSessionId" value={sessionId} />
    <div className="academic-planning-form-grid">
      <label>Class and subject
        <select name="curriculumKey" value={mappingKey} onChange={(event) => setMappingKey(event.target.value)} required>
          <option value="">Choose a mapped class subject</option>
          {curriculum.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </label>
      <label>Term <span className="academic-planning-optional">(optional)</span>
        <select name="termId" defaultValue={plan?.termId ?? ""}>
          <option value="">Full academic session</option>
          {terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
        </select>
      </label>
      <label>Unit number
        <input name="unitNumber" type="number" min="1" max="500" required defaultValue={plan?.unitNumber} placeholder="e.g. 1" />
      </label>
      <label>Unit / learning sequence title
        <input name="title" required minLength={3} maxLength={160} defaultValue={plan?.title} placeholder="e.g. Fractions and equivalent values" />
      </label>
      <label>Assigned teacher <span className="academic-planning-optional">(optional)</span>
        <select name="teacherId" defaultValue={plan?.teacherId ?? ""}>
          <option value="">Unassigned</option>
          {(mapping?.teachers ?? []).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
        </select>
      </label>
      <label>Learning objectives
        <textarea name="learningObjectives" required minLength={10} maxLength={3000} rows={3} defaultValue={plan?.learningObjectives} placeholder="What should students know or be able to do?" />
      </label>
      <label>Key concepts <span className="academic-planning-optional">(optional)</span>
        <textarea name="keyConcepts" maxLength={2000} rows={3} defaultValue={plan?.keyConcepts} placeholder="Vocabulary, skills, and concepts to cover" />
      </label>
      <label>Assessment and success criteria
        <textarea name="assessmentPlan" required minLength={3} maxLength={2000} rows={3} defaultValue={plan?.assessmentPlan} placeholder="How will learning be checked?" />
      </label>
      <label>Learning resources <span className="academic-planning-optional">(optional)</span>
        <textarea name="learningResources" maxLength={2000} rows={3} defaultValue={plan?.learningResources} placeholder="Textbook pages, lab materials, links, or worksheets" />
      </label>
      <label>Planned lessons
        <input name="plannedLessons" type="number" min="1" max="200" required defaultValue={plan?.plannedLessons ?? 4} />
      </label>
      <label>Planned start
        <input name="plannedStartDate" type="date" required defaultValue={plan?.plannedStartDate} />
      </label>
      <label>Planned finish
        <input name="plannedEndDate" type="date" required defaultValue={plan?.plannedEndDate} />
      </label>
      <label>Workflow stage
        <select name="status" defaultValue={plan?.status === "draft" ? "draft" : "planned"}>
          <option value="draft">Draft</option>
          <option value="planned">Ready to teach</option>
        </select>
      </label>
    </div>
  </>;
}

function PlanEditor({
  plan,
  sessionId,
  terms,
  curriculum,
  canManage,
}: {
  plan?: AcademicPlanRow;
  sessionId: string;
  terms: Option[];
  curriculum: CurriculumOption[];
  canManage: boolean;
}) {
  const [state, action] = useActionState(saveAcademicPlan, undefined);
  if (!canManage) return null;

  return <details className="academic-planning-editor">
    <summary>{plan ? "Edit unit plan" : "Build a unit plan"} <span aria-hidden="true">＋</span></summary>
    <form action={action} className="academic-planning-form">
      <Feedback state={state} />
      <PlanFields plan={plan} sessionId={sessionId} terms={terms} curriculum={curriculum} />
      <div className="academic-planning-form__footer">
        <p>Plans stay editable until teaching starts. Progress and reflections are preserved when plan details change.</p>
        <SubmitButton>{plan ? "Save changes" : "Add to academic plan"}</SubmitButton>
      </div>
    </form>
  </details>;
}

function PlanProgress({ plan, canManage }: { plan: AcademicPlanRow; canManage: boolean }) {
  const [state, action] = useActionState(updateAcademicPlanProgress, undefined);
  const [archiveState, archiveAction] = useActionState(archiveAcademicPlan, undefined);
  const percentage = Math.round((plan.completedLessons / plan.plannedLessons) * 100);
  return <>
    <div className="academic-planning-progress">
      <div><span>Lesson progress</span><strong>{plan.completedLessons}/{plan.plannedLessons}</strong></div>
      <div className="academic-planning-progress__track" role="progressbar" aria-label={`${plan.title} lesson progress`} aria-valuenow={plan.completedLessons} aria-valuemin={0} aria-valuemax={plan.plannedLessons}><span style={{ width: `${percentage}%` }} /></div>
    </div>
    {canManage && plan.status !== "archived" && <details className="academic-planning-progress-editor">
      <summary>Update teaching progress</summary>
      <form action={action}>
        <Feedback state={state} />
        <input type="hidden" name="id" value={plan.id} />
        <label>Lessons completed
          <input name="completedLessons" type="number" min="0" max={plan.plannedLessons} defaultValue={plan.completedLessons} required />
        </label>
        <label>Reflection / next steps
          <textarea name="teacherReflection" maxLength={3000} rows={2} defaultValue={plan.teacherReflection} placeholder="What worked well? What needs revisiting?" />
        </label>
        <SubmitButton>Save progress</SubmitButton>
      </form>
    </details>}
    {canManage && <form action={archiveAction} className="academic-planning-archive">
      <input type="hidden" name="id" value={plan.id} />
      <input type="hidden" name="operation" value={plan.status === "archived" ? "restore" : "archive"} />
      <Feedback state={archiveState} />
      <SubmitButton>{plan.status === "archived" ? "Restore unit" : "Archive unit"}</SubmitButton>
    </form>}
  </>;
}

function formatPlanDate(value: string) {
  return new Intl.DateTimeFormat("en", { timeZone: "Asia/Karachi", month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00Z`));
}

function currentSchoolDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function AcademicPlanningBoard({
  sessionId,
  terms,
  curriculum,
  plans,
  canManage,
}: {
  sessionId: string;
  terms: Option[];
  curriculum: CurriculumOption[];
  plans: AcademicPlanRow[];
  canManage: boolean;
}) {
  const today = currentSchoolDate();
  const activePlans = plans.filter((plan) => plan.status !== "archived");
  const completed = activePlans.filter((plan) => plan.status === "completed").length;
  const inProgress = activePlans.filter((plan) => plan.status === "in_progress").length;
  const overdue = activePlans.filter((plan) => plan.status !== "completed" && plan.plannedEndDate < today).length;

  return <>
    <section className="academic-planning-metrics" aria-label="Academic plan progress">
      <article><span>Planned units</span><strong>{activePlans.length}</strong><small>Across mapped subjects</small></article>
      <article><span>In progress</span><strong>{inProgress}</strong><small>Teaching has started</small></article>
      <article><span>Completed</span><strong>{completed}</strong><small>All planned lessons done</small></article>
      <article className={overdue ? "is-warning" : ""}><span>Past target date</span><strong>{overdue}</strong><small>Review or reschedule</small></article>
    </section>
    <div className="academic-planning-toolbar">
      <div><p className="eyebrow">Plan · teach · reflect</p><h2>Units for this session</h2><p>Map each unit to learning outcomes, assessments, a teaching window, and an assigned subject teacher.</p></div>
      {canManage && <PlanEditor sessionId={sessionId} terms={terms} curriculum={curriculum} canManage={canManage} />}
    </div>
    {!curriculum.length ? (
      <section className="academic-planning-empty"><span>01</span><div><h3>Map the curriculum first</h3><p>Academic planning uses the active class and subject mappings for this session, so plans stay connected to your school curriculum.</p><a href="/curriculum">Open Subjects &amp; Classes <span aria-hidden="true">→</span></a></div></section>
    ) : !plans.length ? (
      <section className="academic-planning-empty"><span>02</span><div><h3>Start with your first teaching unit</h3><p>Define outcomes, choose a teaching window, add an assessment approach, then record progress as lessons are delivered.</p>{canManage && <PlanEditor sessionId={sessionId} terms={terms} curriculum={curriculum} canManage={canManage} />}</div></section>
    ) : (
      <section className="academic-planning-grid" aria-label="Academic unit plans">
        {plans.map((plan) => {
          const percentage = Math.round((plan.completedLessons / plan.plannedLessons) * 100);
          const isOverdue = plan.status !== "completed" && plan.plannedEndDate < today;
          return <article className={`academic-planning-card ${isOverdue ? "is-overdue" : ""}`} key={plan.id}>
            <div className="academic-planning-card__top">
              <span className={`academic-planning-status is-${plan.status}`}>{plan.status.replaceAll("_", " ")}</span>
              <span className="academic-planning-card__unit">UNIT {String(plan.unitNumber).padStart(2, "0")}</span>
            </div>
            <h3>{plan.title}</h3>
            <p className="academic-planning-card__subject">{plan.className} <span>·</span> {plan.subjectName}{plan.termName ? <><span>·</span> {plan.termName}</> : null}</p>
            <div className="academic-planning-card__dates">
              <span>{formatPlanDate(plan.plannedStartDate)} – {formatPlanDate(plan.plannedEndDate)}</span>
              <span>{plan.teacherName ?? "Teacher unassigned"}</span>
            </div>
            {isOverdue && <p className="academic-planning-card__overdue">Past planned finish date — review the timeline.</p>}
            <div className="academic-planning-card__outcomes"><span>LEARNING OBJECTIVES</span><p>{plan.learningObjectives}</p></div>
            <div className="academic-planning-progress">
              <div><span>Teaching progress</span><strong>{percentage}%</strong></div>
              <div className="academic-planning-progress__track" role="progressbar" aria-label={`${plan.title} teaching progress`} aria-valuenow={plan.completedLessons} aria-valuemin={0} aria-valuemax={plan.plannedLessons}><span style={{ width: `${percentage}%` }} /></div>
              <small>{plan.completedLessons} of {plan.plannedLessons} lessons complete</small>
            </div>
            <details className="academic-planning-card__details">
              <summary>Unit brief and reflection <span aria-hidden="true">⌄</span></summary>
              <dl>
                {plan.keyConcepts && <><dt>Key concepts</dt><dd>{plan.keyConcepts}</dd></>}
                <dt>Assessment and success criteria</dt><dd>{plan.assessmentPlan}</dd>
                {plan.learningResources && <><dt>Learning resources</dt><dd>{plan.learningResources}</dd></>}
                {plan.teacherReflection && <><dt>Teacher reflection / next steps</dt><dd>{plan.teacherReflection}</dd></>}
              </dl>
            </details>
            <PlanProgress plan={plan} canManage={canManage} />
            {plan.status !== "archived" && <PlanEditor plan={plan} sessionId={sessionId} terms={terms} curriculum={curriculum} canManage={canManage} />}
          </article>;
        })}
      </section>
    )}
    {!canManage && <p className="academic-planning-readonly">You have view-only access. Contact a school administrator to create or update plans.</p>}
  </>;
}
