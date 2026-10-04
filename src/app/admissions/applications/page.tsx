import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAdmissionContext } from "@/lib/admissions/context";

const statuses = ["draft", "submitted", "under_review", "documents_pending", "test_pending", "interview_pending", "approved", "rejected", "waitlisted", "admitted", "converted_to_student"] as const;

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string; error?: string }>;
}) {
  const { schoolId, supabase } = await requireAdmissionContext("view");
  const params = await searchParams;
  const pattern = (params.search ?? "").trim();
  const status = params.status ?? "all";
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 12;

  if (status !== "all" && !statuses.includes(status as typeof statuses[number])) redirect("/admissions/applications");

  let query = supabase
    .from("admissions")
    .select("id,application_number,applicant_name,phone,email,status,application_date,documents_status,test_status,interview_status", { count: "exact" })
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (pattern) query = query.ilike("applicant_name", `%${pattern}%`);
  if (status !== "all") query = query.eq("status", status);

  const start = (page - 1) * pageSize;
  const { data: applications, count, error } = await query.range(start, start + pageSize - 1);
  if (error) {
    return <main className="admissions-page"><section className="admissions-empty" role="alert"><h2>Applications could not be loaded</h2><p>{error.message}</p></section></main>;
  }

  const pageCount = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const makePageHref = (nextPage: number) => `/admissions/applications?page=${nextPage}${pattern ? `&search=${encodeURIComponent(pattern)}` : ""}${status !== "all" ? `&status=${encodeURIComponent(status)}` : ""}`;

  return (
    <main className="admissions-page">
      <section className="admissions-page-heading">
        <div><p className="admissions-eyebrow">Admissions register</p><h1>Applications</h1><p>Search, track and review every applicant for this school.</p></div>
      </section>

      <form method="get" className="admissions-filters">
        <label>Search applicant<input name="search" defaultValue={pattern} placeholder="Enter applicant name" /></label>
        <label>Application status<select name="status" defaultValue={status}><option value="all">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></label>
        <button type="submit">Apply filters</button>
      </form>

      <section className="admissions-table-wrap">
        <div className="admissions-table-summary"><strong>{count ?? 0}</strong><span>application{count === 1 ? "" : "s"}</span></div>
        <div style={{ overflowX: "auto" }}>
          <table className="admissions-table">
            <thead><tr><th>Application</th><th>Applicant</th><th>Contact</th><th>Applied</th><th>Progress</th><th>Status</th><th /></tr></thead>
            <tbody>
              {(applications ?? []).map((application) => (
                <tr key={application.id}>
                  <td><strong>{application.application_number}</strong></td>
                  <td>{application.applicant_name}</td>
                  <td>{application.phone ?? application.email ?? "—"}</td>
                  <td>{new Date(application.application_date).toLocaleDateString()}</td>
                  <td><span className="admissions-progress-label">Docs {titleCase(application.documents_status)}</span><span className="admissions-progress-label">Test {titleCase(application.test_status)}</span><span className="admissions-progress-label">Interview {titleCase(application.interview_status)}</span></td>
                  <td><span className={`admissions-status admissions-status--${application.status}`}>{titleCase(application.status)}</span></td>
                  <td><Link href={`/admissions/${application.id}`} className="admissions-row-link">Open →</Link></td>
                </tr>
              ))}
              {!applications?.length && <tr><td colSpan={7}><div className="admissions-empty"><h2>No applications found</h2><p>Try a different filter or create a new application.</p><Link href="/admissions/new">Create application →</Link></div></td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="admissions-pagination"><span>Page {page} of {pageCount}</span><div>{page > 1 && <Link href={makePageHref(page - 1)}>← Previous</Link>}{page < pageCount && <Link href={makePageHref(page + 1)}>Next →</Link>}</div></footer>
      </section>
    </main>
  );
}
