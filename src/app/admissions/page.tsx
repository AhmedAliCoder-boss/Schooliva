import Link from "next/link";

import { requireAdmissionContext } from "@/lib/admissions/context";

type AdmissionStatus = {
  id: string;
  application_number: string;
  applicant_name: string;
  application_date: string;
  status: string;
  documents_status: string;
  test_status: string;
  interview_status: string;
};

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function AdmissionsPage() {
  const { schoolId, supabase } = await requireAdmissionContext("view");
  const [{ data: admissions, error }, { data: recentApplications, error: recentError }] = await Promise.all([
    supabase
      .from("admissions")
      .select("id,application_number,applicant_name,application_date,status,documents_status,test_status,interview_status")
      .eq("school_id", schoolId),
    supabase
      .from("admissions")
      .select("id,application_number,applicant_name,application_date,status")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (error || recentError) {
    return (
      <main className="admissions-page">
        <section className="admissions-alert admissions-alert--error" role="alert">
          <strong>Admissions overview is unavailable.</strong> {error?.message ?? recentError?.message}
        </section>
      </main>
    );
  }

  const applications = (admissions ?? []) as AdmissionStatus[];
  const totalApplications = applications.length;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const newApplications = applications.filter((admission) => new Date(`${admission.application_date}T00:00:00`) >= monthStart).length;
  const countStatuses = (...statuses: string[]) => applications.filter((admission) => statuses.includes(admission.status)).length;
  const submitted = countStatuses("submitted");
  const underReview = countStatuses("under_review", "documents_pending", "test_pending", "interview_pending");
  const admitted = countStatuses("admitted", "converted_to_student");
  const pendingDocuments = applications.filter((admission) => admission.documents_status === "pending" || admission.status === "documents_pending").length;
  const pendingTests = applications.filter((admission) => admission.test_status === "pending" || admission.status === "test_pending").length;
  const pendingInterviews = applications.filter((admission) => admission.interview_status === "pending" || admission.status === "interview_pending").length;
  const statusRows = [
    { label: "Draft", value: countStatuses("draft"), href: "/admissions/applications?status=draft" },
    { label: "Submitted", value: submitted, href: "/admissions/applications?status=submitted" },
    { label: "Under review", value: underReview, href: "/admissions/applications?status=review" },
    { label: "Admitted", value: admitted, href: "/admissions/applications?status=admitted" },
  ];

  return (
    <main className="admissions-page admissions-overview">
      <section className="admissions-page-heading admissions-overview__heading">
        <div>
          <p className="admissions-eyebrow">Admissions</p>
          <h1>Admissions overview</h1>
          <p>Track applications, follow up on pending steps, and welcome new students.</p>
        </div>
      </section>

      <section className="admissions-overview__metrics" aria-label="Application summary">
        <Link href="/admissions/applications" className="admissions-overview-metric">
          <span>Total applications</span><strong>{totalApplications}</strong><small>All application records</small>
        </Link>
        <Link href="/admissions/applications" className="admissions-overview-metric">
          <span>New this month</span><strong>{newApplications}</strong><small>Received this month</small>
        </Link>
        <Link href="/admissions/applications?status=review" className="admissions-overview-metric">
          <span>In review</span><strong>{underReview}</strong><small>Review and assessment stages</small>
        </Link>
        <Link href="/admissions/applications?status=admitted" className="admissions-overview-metric">
          <span>Admitted</span><strong>{admitted}</strong><small>Includes converted students</small>
        </Link>
      </section>

      <section className="admissions-overview__grid">
        <article className="admissions-card admissions-overview__pipeline">
          <header className="admissions-overview-card-heading">
            <div><p className="admissions-eyebrow">Pipeline</p><h2>Applications by stage</h2></div>
            <Link href="/admissions/applications">Open register <span aria-hidden="true">→</span></Link>
          </header>
          <div className="admissions-overview__stage-list">
            {statusRows.map((item) => (
              <Link href={item.href} className="admissions-overview-stage" key={item.label}>
                <span>{item.label}</span>
                <span className="admissions-overview-stage__track" aria-hidden="true">
                  <i style={{ width: `${totalApplications ? Math.min(100, (item.value / totalApplications) * 100) : 0}%` }} />
                </span>
                <strong>{item.value}</strong>
              </Link>
            ))}
          </div>
          {!totalApplications && <p className="admissions-overview__empty">Applications will appear here as they are created.</p>}
        </article>

        <article className="admissions-card admissions-overview__follow-up">
          <header className="admissions-overview-card-heading">
            <div><p className="admissions-eyebrow">Follow-up</p><h2>Items needing attention</h2></div>
          </header>
          <div className="admissions-overview__follow-up-list">
            <Link href="/admissions/applications?status=documents_pending"><span>Documents to review</span><strong>{pendingDocuments}</strong><span aria-hidden="true">→</span></Link>
            <Link href="/admissions/applications?status=test_pending"><span>Assessments pending</span><strong>{pendingTests}</strong><span aria-hidden="true">→</span></Link>
            <Link href="/admissions/applications?status=interview_pending"><span>Interviews pending</span><strong>{pendingInterviews}</strong><span aria-hidden="true">→</span></Link>
          </div>
        </article>

        <article className="admissions-card admissions-overview__recent">
          <header className="admissions-overview-card-heading">
            <div><p className="admissions-eyebrow">Latest activity</p><h2>Recent applications</h2></div>
            <Link href="/admissions/applications">View all <span aria-hidden="true">→</span></Link>
          </header>
          {recentApplications?.length ? (
            <ul className="admissions-overview__recent-list">
              {recentApplications.map((application) => (
                <li key={application.id}>
                  <Link href={`/admissions/${application.id}`}>
                    <span><strong>{application.applicant_name}</strong><small>{application.application_number} · {new Date(`${application.application_date}T00:00:00`).toLocaleDateString()}</small></span>
                    <span className={`admissions-status admissions-status--${application.status}`}>{titleCase(application.status)}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="admissions-overview__empty">No applications yet. Start with a new application.</p>}
        </article>
      </section>
    </main>
  );
}
