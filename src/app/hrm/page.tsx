import Link from "next/link";

import { HrmLocalDateTime } from "@/components/hrm/hrm-forms";
import { requireHrmContext } from "@/lib/hrm/context";

const stages = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;
const labels: Record<(typeof stages)[number], string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Not selected",
};

export default async function RecruitmentPage() {
  const { supabase, schoolId } = await requireHrmContext("view");
  const now = new Date().toISOString();
  const [
    { count: openVacancies, error: vacancyError },
    { count: allCandidates, error: candidateError },
    { count: upcomingInterviews, error: interviewError },
    { data: stageRows, error: stageError },
    { data: vacancies, error: openingsError },
    { data: interviews, error: upcomingError },
  ] = await Promise.all([
    supabase.from("hrm_job_openings").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "open"),
    supabase.from("hrm_candidates").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    supabase.from("hrm_interviews").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "scheduled").gte("scheduled_at", now),
    supabase.from("hrm_candidates").select("stage").eq("school_id", schoolId),
    supabase.from("hrm_job_openings").select("id,title,department,employee_type,employment_type,closing_date").eq("school_id", schoolId).eq("status", "open").order("created_at", { ascending: false }).limit(5),
    supabase.from("hrm_interviews").select("id,scheduled_at,interview_type,candidate:hrm_candidates(candidate_name,job:hrm_job_openings(title))").eq("school_id", schoolId).eq("status", "scheduled").gte("scheduled_at", now).order("scheduled_at").limit(5),
  ]);
  if (vacancyError || candidateError || interviewError || stageError || openingsError || upcomingError) {
    throw new Error("Recruitment overview could not be loaded.");
  }
  const stageCounts = new Map<string, number>(stages.map((stage) => [stage, 0]));
  for (const candidate of stageRows ?? []) stageCounts.set(candidate.stage, (stageCounts.get(candidate.stage) ?? 0) + 1);
  const pipelineCount = stages.filter((stage) => stage !== "hired" && stage !== "rejected")
    .reduce((total, stage) => total + (stageCounts.get(stage) ?? 0), 0);

  return <main className="students-shell hrm-shell">
    <section className="module-page-header"><div className="module-page-header__row"><div>
      <p className="module-page-header__eyebrow">HRM / Hiring</p><h1>Recruitment.</h1>
      <p>Manage vacancies, move candidates through the hiring pipeline, and keep interviews on schedule.</p>
    </div><Link className="student-primary-action" href="/hrm/jobs">Manage vacancies <span aria-hidden="true">→</span></Link></div></section>
    <section className="payroll-metrics hrm-metrics" aria-label="Recruitment summary">
      <article><span>Open vacancies</span><strong>{openVacancies ?? 0}</strong><small>Accepting candidates</small></article>
      <article><span>All candidates</span><strong>{allCandidates ?? 0}</strong><small>{pipelineCount} in active pipeline</small></article>
      <article><span>Upcoming interviews</span><strong>{upcomingInterviews ?? 0}</strong><small>Scheduled for now or later</small></article>
      <article><span>Offers</span><strong>{stageCounts.get("offer") ?? 0}</strong><small>Awaiting a hiring decision</small></article>
    </section>
    <section className="hrm-dashboard-grid">
      <article className="finance-work-card finance-work-card--records">
        <header className="finance-work-card__heading"><div><span className="dashboard-panel-kicker">Hiring pipeline</span><h2>Candidate progress</h2><p>Current stage for every candidate.</p></div><Link href="/hrm/candidates">View candidates →</Link></header>
        <div className="hrm-pipeline">{stages.map((stage) => <Link href={`/hrm/candidates?stage=${stage}`} className="hrm-pipeline__stage" key={stage}>
          <span>{labels[stage]}</span><strong>{stageCounts.get(stage) ?? 0}</strong>
        </Link>)}</div>
      </article>
      <article className="finance-work-card finance-work-card--records">
        <header className="finance-work-card__heading"><div><span className="dashboard-panel-kicker">Open roles</span><h2>Recent vacancies</h2><p>Positions currently accepting candidates.</p></div><Link href="/hrm/jobs">All vacancies →</Link></header>
        {vacancies?.length ? <ul className="hrm-link-list">{vacancies.map((job) => <li key={job.id}>
          <div><strong>{job.title}</strong><span>{job.department ?? "General"} · {job.employee_type === "teacher" ? "Teacher" : "Staff"} · {job.employment_type.replaceAll("_", " ")}</span></div>
          <Link href="/hrm/candidates">Candidates →</Link>
        </li>)}</ul> : <div className="student-empty"><h3>No open vacancies</h3><p>Publish a vacancy to start recruiting.</p></div>}
      </article>
      <article className="finance-work-card finance-work-card--records">
        <header className="finance-work-card__heading"><div><span className="dashboard-panel-kicker">Interview calendar</span><h2>Upcoming interviews</h2><p>Scheduled conversations with candidates.</p></div><Link href="/hrm/interviews">Interview calendar →</Link></header>
        {interviews?.length ? <ul className="hrm-link-list">{interviews.map((interview) => {
          const candidate = Array.isArray(interview.candidate) ? interview.candidate[0] : interview.candidate;
          return <li key={interview.id}>
            <div><strong>{candidate?.candidate_name ?? "Candidate"}</strong><span><HrmLocalDateTime value={interview.scheduled_at} /> · {interview.interview_type.replaceAll("_", " ")}</span></div>
            <Link href="/hrm/interviews">Review →</Link>
          </li>;
        })}</ul> : <div className="student-empty"><h3>No interviews scheduled</h3><p>Schedule an interview from the interview calendar.</p></div>}
      </article>
      <article className="finance-work-card finance-work-card--records">
        <header className="finance-work-card__heading"><div><span className="dashboard-panel-kicker">Employee lifecycle</span><h2>Employee exits</h2><p>Submit resignation documents, review approvals, and retain employee history.</p></div><Link href="/hrm/exits">Open workflow →</Link></header>
      </article>
    </section>
  </main>;
}
