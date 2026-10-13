import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintAction } from "@/components/print/print-action";
import { SchoolDocument } from "@/components/print/school-document";
import { requireHrmContext } from "@/lib/hrm/context";
import { getSchoolDocumentIdentity } from "@/lib/print/school-document";

function formatDate(value: string | null) {
  if (!value) return "Not specified";
  return new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function HrmVacancyPrintPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { supabase, schoolId } = await requireHrmContext("view");
  const [{ data: job, error }, school] = await Promise.all([
    supabase.from("hrm_job_openings")
      .select("id,title,department,employee_type,employment_type,location,description,requirements,closing_date,status,created_at")
      .eq("id", jobId)
      .eq("school_id", schoolId)
      .maybeSingle(),
    getSchoolDocumentIdentity(supabase, schoolId),
  ]);
  if (error) throw new Error("Vacancy could not be loaded for printing.");
  if (!job) notFound();

  return <main className="school-document-page hrm-vacancy-print-page">
    <div className="school-document-toolbar no-print">
      <Link href="/hrm/jobs">Back to vacancies</Link>
      <PrintAction label="Print vacancy / Save PDF" />
    </div>
    <SchoolDocument
      className="school-document--vacancy"
      school={school}
      title="Vacancy announcement"
      reference={`VAC-${job.id.slice(0, 8).toUpperCase()}`}
    >
      <div className="hrm-vacancy-heading">
        <h3>{job.title}</h3>
        <span className={`hrm-status hrm-status--${job.status}`}>{label(job.status)}</span>
      </div>

      <dl className="school-document__facts hrm-vacancy-facts">
        <div><dt>Department</dt><dd>{job.department?.trim() || "General"}</dd></div>
        <div><dt>Employee record type</dt><dd>{label(job.employee_type)}</dd></div>
        <div><dt>Employment type</dt><dd>{label(job.employment_type)}</dd></div>
        <div><dt>Location</dt><dd>{job.location?.trim() || "School campus"}</dd></div>
        <div><dt>Application deadline</dt><dd>{formatDate(job.closing_date)}</dd></div>
        <div><dt>Posted</dt><dd>{formatDate(job.created_at.slice(0, 10))}</dd></div>
      </dl>

      <h3 className="school-document__section-title">About the role</h3>
      <p className="hrm-vacancy-copy">{job.description?.trim() || "Please contact the school office for further information about this position."}</p>

      {job.requirements?.trim() && <>
        <h3 className="school-document__section-title">Qualifications and requirements</h3>
        <p className="hrm-vacancy-copy">{job.requirements}</p>
      </>}

      <section className="hrm-vacancy-application">
        <h3>{job.status === "open" ? "How to apply" : "Application information"}</h3>
        {job.status === "open"
          ? <p>Please contact the school using the details above and mention vacancy reference <strong>VAC-{job.id.slice(0, 8).toUpperCase()}</strong>. Applications must be submitted by <strong>{formatDate(job.closing_date)}</strong>.</p>
          : <p>This vacancy is currently <strong>{label(job.status).toLowerCase()}</strong>. Contact the school office to confirm whether applications are being accepted.</p>}
      </section>
      <div className="school-document__signatures hrm-vacancy-signature">
        <span>School representative</span>
        <span>Authorized signature</span>
      </div>
    </SchoolDocument>
  </main>;
}
