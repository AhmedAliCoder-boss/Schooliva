import Link from "next/link";

import { CandidateForm, CandidateStageForm, CompleteHireForm } from "@/components/hrm/hrm-forms";
import { requireHrmContext } from "@/lib/hrm/context";

const validStages = ["applied", "screening", "interview", "offer", "hired", "rejected"];
type SearchParams = Promise<{ stage?: string }>;

export default async function HrmCandidatesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const stage = validStages.includes(params.stage ?? "") ? params.stage! : "all";
  const { supabase, schoolId } = await requireHrmContext("view");
  const [
    { data: jobs, error: jobsError },
    { data: candidates, error: candidatesError },
    { data: sessions, error: sessionsError },
    { data: subjects, error: subjectsError },
    { data: classes, error: classesError },
    { data: classSubjects, error: classSubjectsError },
  ] = await Promise.all([
    supabase.from("hrm_job_openings").select("id,title,employee_type,status").eq("school_id", schoolId).order("title"),
    (() => {
      let query = supabase.from("hrm_candidates").select("id,candidate_name,email,phone,source,stage,job_id,created_at,hired_employee_id,hired_employee_type,hired_employee_code,hired_application_user_id,job:hrm_job_openings(title,employee_type)")
        .eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100);
      if (stage !== "all") query = query.eq("stage", stage);
      return query;
    })(),
    supabase.from("academic_sessions").select("id,name").eq("school_id", schoolId).eq("status", "active").order("starts_on", { ascending: false }),
    supabase.from("subjects").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("classes").select("id,name").eq("school_id", schoolId).eq("status", "active").order("name"),
    supabase.from("class_subjects").select("class_id,subject_id").eq("school_id", schoolId),
  ]);
  if (jobsError || candidatesError || sessionsError || subjectsError || classesError || classSubjectsError) {
    console.error("Candidate pipeline or teacher subject setup could not be loaded.", jobsError ?? candidatesError ?? sessionsError ?? subjectsError ?? classesError ?? classSubjectsError);
    throw new Error("Candidate pipeline and teacher subject setup could not be loaded.");
  }
  const jobRows = jobs ?? [];
  const openJobRows = jobRows.filter((job) => job.status === "open");
  const candidateRows = candidates ?? [];

  return <main className="students-shell hrm-shell">
    <section className="module-page-header"><div>
      <p className="module-page-header__eyebrow">HRM / Recruitment</p><h1>Candidates.</h1>
      <p>Keep applicant contact details, their role, and every hiring decision in one pipeline.</p>
    </div></section>
    <section className="hrm-candidates-grid">
      <article className="finance-work-card finance-work-card--records hrm-candidate-intake">
        <header className="finance-work-card__heading"><div><span className="dashboard-panel-kicker">Applicant intake</span><h2>Add a candidate</h2><p>Record an applicant against an open vacancy or as a general application.</p></div></header>
        <details className="hrm-candidate-intake__disclosure">
          <summary><span>Add candidate details</span><small>Contact information, vacancy, and notes</small></summary>
          <CandidateForm jobs={openJobRows} />
        </details>
      </article>
      <article className="finance-work-card finance-work-card--records hrm-candidate-register">
        <header className="finance-work-card__heading"><div><span className="dashboard-panel-kicker">Hiring pipeline</span><h2>Candidate register</h2><p>Update stage as the applicant moves through hiring.</p></div></header>
        <form className="student-filters hrm-filter"><label>Stage<select name="stage" defaultValue={stage}><option value="all">All stages</option><option value="applied">Applied</option><option value="screening">Screening</option><option value="interview">Interview</option><option value="offer">Offer</option><option value="hired">Hired</option><option value="rejected">Not selected</option></select></label><button type="submit">Filter</button></form>
        {candidateRows.length ? <div className="hrm-candidate-list">
          {candidateRows.map((candidate) => {
            const job = Array.isArray(candidate.job) ? candidate.job[0] : candidate.job;
            return <article className="hrm-candidate-card" key={candidate.id}>
              <header className="hrm-candidate-card__header">
                <div className="hrm-candidate-card__identity">
                  <span className="hrm-candidate-card__avatar" aria-hidden="true">{candidate.candidate_name.trim().charAt(0).toUpperCase()}</span>
                  <div><h3>{candidate.candidate_name}</h3><p>{candidate.email ?? candidate.phone ?? "No contact details"}</p></div>
                </div>
                <span className={`hrm-status hrm-status--${candidate.stage}`}>{candidate.stage.replaceAll("_", " ")}</span>
              </header>
              <dl className="hrm-candidate-card__details">
                <div><dt>Vacancy</dt><dd>{job?.title ?? "General application"}</dd></div>
                <div><dt>Source</dt><dd>{candidate.source.replaceAll("_", " ")}</dd></div>
                {job?.employee_type && <div><dt>Position type</dt><dd>{job.employee_type === "teacher" ? "Teacher" : "Staff"}</dd></div>}
              </dl>
              <div className="hrm-candidate-card__action">
                <span>{candidate.stage === "offer" ? "Complete the hiring record" : candidate.stage === "hired" ? "Employee record" : "Update application"}</span>
                {candidate.stage === "offer" && job?.employee_type ? <CompleteHireForm
                  candidateId={candidate.id}
                  employeeType={job.employee_type}
                  sessions={sessions ?? []}
                  subjects={subjects ?? []}
                  classes={classes ?? []}
                  classSubjects={classSubjects ?? []}
                />
                  : candidate.stage === "hired" && candidate.hired_employee_id && candidate.hired_employee_type
                    ? <div className="hrm-hired-employee"><strong>{candidate.hired_employee_code}</strong><small>User ID: {candidate.hired_application_user_id ?? "—"}</small><Link href={candidate.hired_employee_type === "teacher" ? `/teachers/${candidate.hired_employee_id}` : `/staff/${candidate.hired_employee_id}`}>Employee profile →</Link></div>
                    : <CandidateStageForm id={candidate.id} stage={candidate.stage} jobId={candidate.job_id} jobs={jobRows} />}
              </div>
            </article>;
          })}
        </div> : <div className="student-empty"><h3>No candidates found</h3><p>{stage === "all" ? "Add the first applicant to start the hiring pipeline." : "There are no candidates at this stage."}</p>{stage !== "all" && <Link href="/hrm/candidates">Show all candidates</Link>}</div>}
      </article>
    </section>
  </main>;
}
