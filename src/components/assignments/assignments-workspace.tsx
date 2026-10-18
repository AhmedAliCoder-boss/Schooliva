"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AssignmentForm, AssignmentStatusForm, ReviewForm, SubmissionForm } from "@/components/assignments/assignment-forms";
import { formatPlatformDate } from "@/lib/format/date";

type Option = { id: string; name: string };
type Submission = {
  id: string;
  studentId: string;
  studentName: string;
  studentIdentifier: string;
  content: string | null;
  status: string;
  marks: number | null;
  feedback: string | null;
  submittedAt: string | null;
};
type Assignment = {
  id: string;
  title: string;
  description: string;
  issueDate: string;
  dueDate: string;
  status: string;
  maxMarks: number | null;
  sessionName: string;
  className: string;
  sectionName: string;
  subjectName: string;
  teacherName: string;
  expectedSubmissions: number;
  submissions: Submission[];
};

type Filter = "all" | "upcoming" | "needs-review" | "completed";

function shortDate(value: string) {
  return formatPlatformDate(value);
}

function statusLabel(status: string) {
  if (status === "graded" || status === "reviewed") return "Reviewed";
  if (status === "late") return "Late";
  if (status === "submitted") return "Submitted";
  if (status === "draft") return "Draft";
  if (status === "closed") return "Closed";
  return status;
}

function submissionTone(status: string) {
  if (status === "graded" || status === "reviewed") return "is-reviewed";
  if (status === "late") return "is-late";
  if (status === "submitted") return "is-submitted";
  return "is-pending";
}

export function AssignmentsWorkspace({
  assignments,
  permissions,
  currentStudentId,
  sessions,
  classes,
  sections,
  subjects,
  teachers,
  defaultSessionId,
  today,
}: {
  assignments: Assignment[];
  permissions: { canManage: boolean; canSubmit: boolean; canReview: boolean };
  currentStudentId: string;
  sessions: Option[];
  classes: Option[];
  sections: Array<Option & { class_id: string }>;
  subjects: Option[];
  teachers: Array<Option & { name: string }>;
  defaultSessionId: string;
  today: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const stats = useMemo(() => {
    const reviewCount = assignments.reduce((total, assignment) =>
      total + assignment.submissions.filter((submission) => ["submitted", "late"].includes(submission.status)).length, 0);
    const dueSoon = assignments.filter((assignment) => {
      if (assignment.status !== "open" || assignment.dueDate < today) return false;
      const days = (new Date(`${assignment.dueDate}T00:00:00`).valueOf() - new Date(`${today}T00:00:00`).valueOf()) / 86400000;
      return days <= 3;
    }).length;
    const submittedCount = assignments.reduce((total, assignment) => total + assignment.submissions.length, 0);
    const expectedCount = assignments.reduce((total, assignment) => total + assignment.expectedSubmissions, 0);
    return { total: assignments.length, reviewCount, dueSoon, submittedCount, expectedCount };
  }, [assignments, today]);

  const filters: Array<{ id: Filter; label: string; count: number }> = [
    { id: "all", label: "All work", count: assignments.length },
    { id: "upcoming", label: "Due soon", count: stats.dueSoon },
    { id: "needs-review", label: "Needs review", count: assignments.filter((item) =>
      item.submissions.some((submission) => ["submitted", "late"].includes(submission.status))).length },
    { id: "completed", label: "Closed", count: assignments.filter((item) => item.status === "closed").length },
  ];
  const visibleAssignments = assignments.filter((assignment) => {
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch = !query || [
      assignment.title,
      assignment.description,
      assignment.className,
      assignment.sectionName,
      assignment.subjectName,
      assignment.teacherName,
    ].some((value) => value.toLocaleLowerCase().includes(query));
    const dueSoon = assignment.status === "open" && assignment.dueDate >= today
      && (new Date(`${assignment.dueDate}T00:00:00`).valueOf() - new Date(`${today}T00:00:00`).valueOf()) / 86400000 <= 3;
    const needsReview = assignment.submissions.some((submission) => ["submitted", "late"].includes(submission.status));
    return matchesSearch
      && (filter === "all"
        || (filter === "upcoming" && dueSoon)
        || (filter === "needs-review" && needsReview)
        || (filter === "completed" && assignment.status === "closed"));
  });

  return <div className="assignments-workspace">
    <header className="students-header assignments-header">
      <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
      <nav aria-label="Assignment navigation">
        <Link className="text-action" href="/dashboard">Dashboard</Link>
        <Link className="text-action" href="/academic-planning">Academic planning</Link>
      </nav>
    </header>

    <section className="assignments-hero">
      <div>
        <p className="eyebrow">Learning workflow</p>
        <h1>Assignments.</h1>
        <p>{permissions.canSubmit && currentStudentId
          ? "Open your assignment, choose “Send your work to teacher”, and submit your answer before the due date. Check here later for marks and feedback."
          : "Plan classroom work, keep deadlines visible, and follow every submission through review."}</p>
      </div>
      {permissions.canManage && <button className="assignments-primary-action" type="button" onClick={() => setShowCreate((open) => !open)}>
        {showCreate ? "Close form" : "＋ New assignment"}
      </button>}
    </section>

    <section className="assignments-metrics" aria-label="Assignment overview">
      <article><span className="assignments-metric-icon is-blue">▤</span><div><strong>{stats.total}</strong><span>Assignments</span></div></article>
      <article><span className="assignments-metric-icon is-amber">◷</span><div><strong>{stats.dueSoon}</strong><span>Due in 3 days</span></div></article>
      <article><span className="assignments-metric-icon is-violet">✎</span><div><strong>{stats.reviewCount}</strong><span>Awaiting review</span></div></article>
      <article><span className="assignments-metric-icon is-green">✓</span><div><strong>{stats.expectedCount ? `${stats.submittedCount}/${stats.expectedCount}` : stats.submittedCount}</strong><span>Submissions received</span></div></article>
    </section>

    {permissions.canSubmit && !currentStudentId && <aside className="assignment-student-account-note" role="status">
      <strong>Submit from your student account</strong>
      <p>Assignment work is submitted by the student from their own linked Schooliva login. If this is your student account and you do not see a submission option, ask your school administrator to link your login to your student record.</p>
    </aside>}

    {showCreate && permissions.canManage && <section className="assignments-create-card" id="create-assignment">
      <div className="assignments-section-heading">
        <div><p className="eyebrow">Create and publish</p><h2>Set up classwork</h2></div>
        <p>Students in the selected class and section will see the instructions and due date.</p>
      </div>
      <AssignmentForm sessions={sessions} classes={classes} sections={sections} subjects={subjects} teachers={teachers} defaultSessionId={defaultSessionId} today={today} />
    </section>}

    <section className="assignments-register">
      <div className="assignments-register__heading">
        <div><p className="eyebrow">Assignment register</p><h2>Classwork & submissions</h2></div>
        <label className="assignments-search">
          <span aria-hidden="true">⌕</span>
          <input type="search" aria-label="Search assignments" placeholder="Search assignments" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>

      <div className="assignments-filter-tabs" role="tablist" aria-label="Filter assignments">
        {filters.map((item) => <button
          aria-selected={filter === item.id}
          className={filter === item.id ? "is-active" : ""}
          key={item.id}
          onClick={() => setFilter(item.id)}
          role="tab"
          type="button"
        >{item.label}<span>{item.count}</span></button>)}
      </div>

      {visibleAssignments.length ? <div className="assignments-list">
        {visibleAssignments.map((assignment) => {
          const ownSubmission = assignment.submissions.find((submission) => submission.studentId === currentStudentId);
          const submittedCount = assignment.submissions.length;
          const reviewCount = assignment.submissions.filter((submission) => ["submitted", "late"].includes(submission.status)).length;
          const gradedCount = assignment.submissions.filter((submission) => ["graded", "reviewed"].includes(submission.status)).length;
          const isOverdue = assignment.status === "open" && assignment.dueDate < today;
          const remaining = Math.max(0, assignment.expectedSubmissions - submittedCount);

          return <article className="assignment-card" key={assignment.id}>
            <div className="assignment-card__accent" />
            <div className="assignment-card__main">
              <div className="assignment-card__topline">
                <div className="assignment-card__tags">
                  <span className="assignment-chip">{assignment.subjectName}</span>
                  <span className={`assignment-state is-${assignment.status}`}>{statusLabel(assignment.status)}</span>
                  {isOverdue && <span className="assignment-state is-overdue">Past due</span>}
                </div>
                <span className="assignment-due">{assignment.issueDate > today ? "Opens" : assignment.status === "closed" ? "Closed" : "Due"} <strong>{shortDate(assignment.issueDate > today ? assignment.issueDate : assignment.dueDate)}</strong></span>
              </div>
              <h3>{assignment.title}</h3>
              {assignment.description && <p className="assignment-card__description">{assignment.description}</p>}
              <div className="assignment-card__meta">
                <span><strong>{assignment.className}</strong> · {assignment.sectionName}</span>
                <span>{assignment.sessionName}</span>
                {assignment.teacherName && <span>Assigned by {assignment.teacherName}</span>}
                {assignment.maxMarks !== null && <span>{assignment.maxMarks} marks</span>}
              </div>

              <div className="assignment-progress">
                <div className="assignment-progress__labels">
                  <strong>{permissions.canManage || permissions.canReview
                    ? `${submittedCount}${assignment.expectedSubmissions ? ` of ${assignment.expectedSubmissions}` : ""} submitted`
                    : ownSubmission ? "Your work is submitted" : "Your work is not submitted"}</strong>
                  {permissions.canManage || permissions.canReview
                    ? <span>{reviewCount} to review · {gradedCount} reviewed{remaining ? ` · ${remaining} outstanding` : ""}</span>
                    : ownSubmission && <span>{statusLabel(ownSubmission.status)}</span>}
                </div>
                {(permissions.canManage || permissions.canReview) && assignment.expectedSubmissions > 0
                  && <div className="assignment-progress__track" role="progressbar"
                    aria-label={`${submittedCount} of ${assignment.expectedSubmissions} submissions`}
                    aria-valuemin={0} aria-valuemax={assignment.expectedSubmissions}
                    aria-valuenow={Math.min(submittedCount, assignment.expectedSubmissions)}>
                    <span style={{ width: `${Math.min(100, (submittedCount / assignment.expectedSubmissions) * 100)}%` }} />
                  </div>}
              </div>

              {permissions.canManage && <AssignmentStatusForm assignmentId={assignment.id} status={assignment.status} />}

              {permissions.canSubmit && currentStudentId && assignment.status === "open" && assignment.issueDate <= today
                && ownSubmission?.status !== "graded" && ownSubmission?.status !== "reviewed"
                && <details className="assignment-student-work">
                  <summary>
                    <span>{ownSubmission ? "Update your submission" : "Send your work to teacher"}</span>
                    <span aria-hidden="true">{ownSubmission ? "Edit response" : "Submit assignment"} <i>→</i></span>
                  </summary>
                  <SubmissionForm assignmentId={assignment.id} initialContent={ownSubmission?.content ?? ""} />
                </details>}

              {ownSubmission && <div className="assignment-own-submission">
                <div><strong>Your submission</strong><span className={`assignment-state ${submissionTone(ownSubmission.status)}`}>{statusLabel(ownSubmission.status)}</span></div>
                {ownSubmission.content && <p>{ownSubmission.content}</p>}
                {(ownSubmission.marks !== null || ownSubmission.feedback) && <section className="assignment-own-feedback" aria-label="Teacher marks and feedback">
                  <strong>Teacher marks &amp; feedback</strong>
                  {ownSubmission.marks !== null && <span>{ownSubmission.marks}{assignment.maxMarks !== null ? ` / ${assignment.maxMarks}` : ""} marks</span>}
                  {ownSubmission.feedback && <p>{ownSubmission.feedback}</p>}
                </section>}
              </div>}

              {(permissions.canManage || permissions.canReview) && <details className="assignment-submission-details" open={reviewCount > 0}>
                <summary>
                  <span>Mark &amp; give feedback <strong>{reviewCount} to review</strong></span>
                  <span className="assignment-submission-details__toggle" aria-hidden="true">⌄</span>
                </summary>
                {assignment.submissions.length ? <div className="assignment-submission-list">
                  {assignment.submissions.map((submission) => <article className="assignment-submission" key={submission.id}>
                    <div className="assignment-submission__identity">
                      <span className="assignment-avatar" aria-hidden="true">{submission.studentName.slice(0, 1).toLocaleUpperCase() || "S"}</span>
                      <span><strong>{submission.studentName || "Student"}</strong><small>{submission.studentIdentifier} · {submission.submittedAt ? shortDate(submission.submittedAt.slice(0, 10)) : "Not submitted"}</small></span>
                    </div>
                    <span className={`assignment-state ${submissionTone(submission.status)}`}>{statusLabel(submission.status)}</span>
                    {submission.content && <p className="assignment-submission__content">{submission.content}</p>}
                    {["submitted", "late"].includes(submission.status) && permissions.canReview
                      ? <ReviewForm submissionId={submission.id} marks={submission.marks} feedback={submission.feedback} maxMarks={assignment.maxMarks} />
                      : submission.status === "graded" || submission.status === "reviewed"
                        ? <div className="assignment-review-summary">
                          {submission.marks !== null && <strong>{submission.marks}{assignment.maxMarks !== null ? ` / ${assignment.maxMarks}` : ""} marks</strong>}
                          {submission.feedback && <p>{submission.feedback}</p>}
                        </div>
                        : null}
                  </article>)}
                  {remaining > 0 && <p className="assignment-outstanding-note">{remaining} student{remaining === 1 ? "" : "s"} ha{remaining === 1 ? "s" : "ve"} not submitted yet.</p>}
                </div> : <div className="assignment-submission-empty"><strong>No submissions yet</strong><span>Student work will appear here as it comes in.</span></div>}
              </details>}
            </div>
          </article>;
        })}
      </div> : <div className="assignments-empty">
        <span aria-hidden="true">▤</span>
        <h3>{assignments.length ? "No matching assignments" : "Your assignment workspace is ready"}</h3>
        <p>{assignments.length
          ? "Try a different search or filter to find the classwork you need."
          : permissions.canManage
            ? "Create the first assignment to give students a clear task and deadline."
            : "Assignments published for your class will appear here."}</p>
        {!assignments.length && permissions.canManage && <button type="button" onClick={() => setShowCreate(true)}>Create an assignment</button>}
      </div>}
    </section>
  </div>;
}
