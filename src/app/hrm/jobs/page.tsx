import Link from "next/link";

import { JobOpeningForm, JobOpeningStatusForm } from "@/components/hrm/hrm-forms";
import { requireHrmContext } from "@/lib/hrm/context";

export default async function HrmJobsPage() {
  const { supabase, schoolId } = await requireHrmContext("view");
  const { data: openings, error } = await supabase.from("hrm_job_openings")
    .select("id,title,department,employee_type,employment_type,location,closing_date,status,created_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Vacancies could not be loaded.");
  const jobRows = openings ?? [];

  return <main className="students-shell hrm-shell">
    <section className="module-page-header"><div>
      <p className="module-page-header__eyebrow">HRM / Recruitment</p><h1>Vacancies.</h1>
      <p>Create and manage the roles your school is hiring for.</p>
    </div></section>
    <section className="hrm-work-grid">
      <article className="finance-work-card finance-work-card--records hrm-create-card">
        <header className="finance-work-card__heading"><div><span className="dashboard-panel-kicker">New position</span><h2>Publish a vacancy</h2><p>Draft a role now or open it to start adding candidates.</p></div></header>
        <JobOpeningForm />
      </article>
      <article className="finance-work-card finance-work-card--records">
        <header className="finance-work-card__heading"><div><span className="dashboard-panel-kicker">Vacancy register</span><h2>All positions</h2><p>Up to 100 of the most recently created vacancies.</p></div></header>
        {jobRows.length ? <div className="student-table-wrap"><table className="student-table hrm-table">
          <thead><tr><th>Position</th><th>Record type</th><th>Employment</th><th>Deadline</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>{jobRows.map((job) => <tr key={job.id}>
            <td><strong>{job.title}</strong><small>{job.department ?? "General"}{job.location ? ` · ${job.location}` : ""}</small></td>
            <td>{job.employee_type === "teacher" ? "Teacher" : "Staff"}</td>
            <td>{job.employment_type.replaceAll("_", " ")}</td>
            <td>{job.closing_date ?? "Not set"}</td>
            <td><span className={`hrm-status hrm-status--${job.status}`}>{job.status}</span></td>
            <td><div className="hrm-vacancy-actions">
              <Link href={`/hrm/jobs/${job.id}/print`} className="hrm-print-link">Print vacancy</Link>
              <JobOpeningStatusForm id={job.id} status={job.status} />
            </div></td>
          </tr>)}</tbody>
        </table></div> : <div className="student-empty"><h3>No vacancies yet</h3><p>Create the first position using the form.</p></div>}
      </article>
    </section>
  </main>;
}
