import { HrmLocalDateTime, InterviewScheduleForm, InterviewStatusForm } from "@/components/hrm/hrm-forms";
import { requireHrmContext } from "@/lib/hrm/context";

export default async function HrmInterviewsPage() {
  const { supabase, schoolId } = await requireHrmContext("view");
  const [{ data: candidates, error: candidatesError }, { data: interviews, error: interviewsError }] = await Promise.all([
    supabase.from("hrm_candidates").select("id,candidate_name,job:hrm_job_openings(title)").eq("school_id", schoolId).neq("stage", "rejected").neq("stage", "hired").order("candidate_name"),
    supabase.from("hrm_interviews").select("id,scheduled_at,interview_type,location,interviewer,status,candidate:hrm_candidates(candidate_name,job:hrm_job_openings(title))").eq("school_id", schoolId).order("scheduled_at", { ascending: false }).limit(100),
  ]);
  if (candidatesError || interviewsError) throw new Error("Interview calendar could not be loaded.");
  const candidateOptions = (candidates ?? []).map((candidate) => {
    const job = Array.isArray(candidate.job) ? candidate.job[0] : candidate.job;
    return { id: candidate.id, candidate_name: candidate.candidate_name, job_title: job?.title ?? null };
  });
  const interviewRows = interviews ?? [];

  return <main className="students-shell hrm-shell">
    <section className="module-page-header"><div>
      <p className="module-page-header__eyebrow">HRM / Recruitment</p><h1>Interviews.</h1>
      <p>Coordinate candidate interviews and keep outcomes attached to the hiring record.</p>
    </div></section>
    <section className="hrm-work-grid">
      <article className="finance-work-card finance-work-card--records hrm-create-card">
        <header className="finance-work-card__heading"><div><span className="dashboard-panel-kicker">Interview planning</span><h2>Schedule an interview</h2><p>Choose a candidate, meeting type, time, and interviewer.</p></div></header>
        <InterviewScheduleForm candidates={candidateOptions} />
      </article>
      <article className="finance-work-card finance-work-card--records">
        <header className="finance-work-card__heading"><div><span className="dashboard-panel-kicker">Interview calendar</span><h2>All interviews</h2><p>Review scheduled, completed, and cancelled interviews.</p></div></header>
        {interviewRows.length ? <div className="student-table-wrap"><table className="student-table hrm-table">
          <thead><tr><th>Candidate</th><th>Time</th><th>Format / location</th><th>Interviewer</th><th>Status</th></tr></thead>
          <tbody>{interviewRows.map((interview) => {
            const candidate = Array.isArray(interview.candidate) ? interview.candidate[0] : interview.candidate;
            const job = Array.isArray(candidate?.job) ? candidate.job[0] : candidate?.job;
            return <tr key={interview.id}>
              <td><strong>{candidate?.candidate_name ?? "Candidate"}</strong><small>{job?.title ?? "General application"}</small></td>
              <td><HrmLocalDateTime value={interview.scheduled_at} /></td>
              <td>{interview.interview_type.replaceAll("_", " ")}{interview.location ? <small>{interview.location}</small> : null}</td>
              <td>{interview.interviewer ?? "Not assigned"}</td>
              <td><InterviewStatusForm id={interview.id} status={interview.status} /></td>
            </tr>;
          })}</tbody>
        </table></div> : <div className="student-empty"><h3>No interviews yet</h3><p>Schedule the first interview after adding candidates.</p></div>}
      </article>
    </section>
  </main>;
}
