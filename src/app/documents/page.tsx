import Link from "next/link";

import { EmployeeVerificationReviewForm } from "@/components/hrm/employee-verification-upload-form";
import type { EmployeeDocumentOption } from "@/components/hrm/employee-verification-upload-form";
import { EmployeeDocumentGenerator } from "@/components/hrm/employee-document-generator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireHrmContext } from "@/lib/hrm/context";

type EmployeeType = "teacher" | "staff";
type EmployeeRow = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  type: EmployeeType;
};
type DocumentRow = {
  id: string;
  employee_id: string;
  employee_type: EmployeeType;
  document_type: string;
  storage_path: string;
  original_name: string;
  content_type: string;
  file_size: number;
  created_at: string;
  status: "pending" | "verified" | "rejected";
};
type GeneratedDocumentRow = {
  id: string;
  employee_id: string;
  employee_type: EmployeeType;
  document_type: string;
  document_number: string;
  issued_on: string;
  created_at: string;
};
type SearchParams = Promise<{ search?: string; type?: string; status?: string }>;

const documentLabels: Record<string, string> = {
  national_id: "National ID / CNIC",
  qualification: "Qualification",
  experience: "Experience",
  police_verification: "Police verification",
};
const generatedDocumentLabels: Record<string, string> = {
  appointment: "Appointment letter",
  experience: "Experience letter",
  employment_verification: "Employment verification",
  promotion: "Promotion letter",
  relieving: "Relieving letter",
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

export default async function EmployeeDocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const search = params.search?.trim().toLocaleLowerCase() ?? "";
  const type = params.type === "teacher" || params.type === "staff" ? params.type : "all";
  const status = params.status === "pending" || params.status === "verified" || params.status === "rejected" ? params.status : "all";
  const { supabase, schoolId } = await requireHrmContext("view");
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  const monthStartDate = monthStart.toISOString().slice(0, 10);
  const [
    { data: teachers, error: teacherError },
    { data: staff, error: staffError },
    { data: documents, error: documentError },
    { data: canManage, error: permissionError },
    { data: generatedDocuments, error: generatedDocumentError, count: generatedDocumentCount },
    { count: generatedThisMonthCount, error: generatedThisMonthError },
  ] = await Promise.all([
    supabase.from("teachers").select("id,employee_code,first_name,last_name").eq("school_id", schoolId).order("last_name"),
    supabase.from("staff").select("id,employee_code,first_name,last_name").eq("school_id", schoolId).order("last_name"),
    supabase.from("hrm_employee_documents")
      .select("id,employee_id,employee_type,document_type,storage_path,original_name,content_type,file_size,created_at,status")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false }),
    supabase.rpc("has_permission", {
      target_school_id: schoolId,
      target_resource: "recruitment",
      target_action: "manage",
    }),
    supabase.from("hrm_employee_generated_documents")
      .select("id,employee_id,employee_type,document_type,document_number,issued_on,created_at", { count: "exact" })
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("hrm_employee_generated_documents")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .gte("issued_on", monthStartDate),
  ]);
  if (teacherError || staffError || documentError || permissionError || generatedDocumentError || generatedThisMonthError) {
    console.error("Employee document workspace data could not be loaded.", {
      teacherError,
      staffError,
      documentError,
      permissionError,
      generatedDocumentError,
      generatedThisMonthError,
    });
    throw new Error("Employee document workspace data could not be loaded.");
  }

  const employees: EmployeeRow[] = [
    ...(teachers ?? []).map((employee) => ({ ...employee, type: "teacher" as const })),
    ...(staff ?? []).map((employee) => ({ ...employee, type: "staff" as const })),
  ];
  const employeeByKey = new Map(employees.map((employee) => [`${employee.type}:${employee.id}`, employee]));
  const employeeOptions: EmployeeDocumentOption[] = employees
    .map((employee) => ({
      id: employee.id,
      type: employee.type,
      label: `${employee.first_name} ${employee.last_name} · ${employee.employee_code} · ${employee.type === "teacher" ? "Teacher" : "Staff"}`,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
  const rows = (documents ?? []) as DocumentRow[];
  const generatedRows = (generatedDocuments ?? []) as GeneratedDocumentRow[];
  const filteredRows = rows.filter((document) => {
    if (type !== "all" && document.employee_type !== type) return false;
    if (status !== "all" && document.status !== status) return false;
    if (!search) return true;
    const employee = employeeByKey.get(`${document.employee_type}:${document.employee_id}`);
    const searchable = [
      document.original_name,
      documentLabels[document.document_type] ?? document.document_type,
      employee?.first_name,
      employee?.last_name,
      employee?.employee_code,
    ].join(" ").toLocaleLowerCase();
    return searchable.includes(search);
  });
  const adminClient = createSupabaseAdminClient();
  if (rows.length && !adminClient) {
    throw new Error("Employee document links cannot be generated without server-side Supabase administration.");
  }
  const documentsWithLinks = await Promise.all(filteredRows.map(async (document) => {
    if (!adminClient) throw new Error("Employee document links are not configured.");
    const { data, error } = await adminClient.storage.from("employee-verification").createSignedUrl(document.storage_path, 600);
    if (error || !data?.signedUrl) {
      console.error("Could not create a signed link for an employee document.", { documentId: document.id, error });
      throw new Error("An employee document could not be opened.");
    }
    return {
      ...document,
      employee: employeeByKey.get(`${document.employee_type}:${document.employee_id}`),
      label: documentLabels[document.document_type] ?? document.document_type,
      url: data.signedUrl,
    };
  }));
  const pendingCount = rows.filter((document) => document.status === "pending").length;
  const verifiedCount = rows.filter((document) => document.status === "verified").length;
  const rejectedCount = rows.filter((document) => document.status === "rejected").length;

  return <main className="students-shell hrm-shell employee-documents-page">
    <section className="module-page-header">
      <div className="module-page-header__row">
        <div>
          <p className="module-page-header__eyebrow">HRM / Employee records</p>
          <h1>Employee documents.</h1>
          <p>Review employee verification files and track school-issued appointment, experience, promotion, and service letters.</p>
        </div>
        <Link className="student-primary-action" href="/hrm/employees">View employees <span aria-hidden="true">→</span></Link>
      </div>
    </section>

    <section className="employee-documents-stats" aria-label="Employee document summary">
      <article><span>All documents</span><strong>{rows.length}</strong><small>Across teachers and staff</small></article>
      <article className="employee-documents-stats__pending"><span>Pending review</span><strong>{pendingCount}</strong><small>Waiting for verification</small></article>
      <article className="employee-documents-stats__verified"><span>Verified</span><strong>{verifiedCount}</strong><small>Approved employee records</small></article>
      <article className="employee-documents-stats__rejected"><span>Needs replacement</span><strong>{rejectedCount}</strong><small>Follow up with employee</small></article>
      <article className="employee-documents-stats__issued"><span>Letters issued</span><strong>{generatedDocumentCount ?? 0}</strong><small>All generated employee letters</small></article>
      <article className="employee-documents-stats__month"><span>Issued this month</span><strong>{generatedThisMonthCount ?? 0}</strong><small>Based on the issue date</small></article>
    </section>

    <section className="student-panel employee-documents-upload employee-documents-generate">
      <div className="student-panel-heading">
        <div><h2>Generate an employee letter</h2><span>Choose a document type to see its required details; generated letters are included in the overview and register.</span></div>
      </div>
      {canManage && employeeOptions.length
        ? <EmployeeDocumentGenerator employees={employeeOptions} />
        : canManage
          ? <p className="student-muted">Add a teacher or staff record before generating an employee letter.</p>
          : <p className="student-muted">You can view issued employee documents. HRM manage permission is required to issue letters.</p>}
    </section>

    <section className="student-panel employee-documents-register employee-generated-documents-register">
      <div className="student-panel-heading">
        <div><h2>Issued employee letters</h2><span>Saved, school-scoped official document history</span></div>
        <span>Showing {generatedRows.length} of {generatedDocumentCount ?? 0} records</span>
      </div>
      {generatedRows.length ? <div className="student-table-wrap">
        <table className="student-table">
          <thead><tr><th>Employee</th><th>Document</th><th>Reference</th><th>Issued</th><th>Action</th></tr></thead>
          <tbody>{generatedRows.map((document) => {
            const employee = employeeByKey.get(`${document.employee_type}:${document.employee_id}`);
            return <tr key={document.id}>
              <td>
                <Link className="employee-document-person" href={`/${document.employee_type === "teacher" ? "teachers" : "staff"}/${document.employee_id}`}>
                  <strong>{employee ? `${employee.first_name} ${employee.last_name}` : "Employee record"}</strong>
                  <small>{employee?.employee_code ?? "Profile unavailable"} · {document.employee_type}</small>
                </Link>
              </td>
              <td>{generatedDocumentLabels[document.document_type] ?? document.document_type}</td>
              <td>{document.document_number}</td>
              <td>{formatDate(document.issued_on)}</td>
              <td><Link className="text-action" href={`/documents/generated/${document.id}`}>View / print →</Link></td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <div className="student-empty"><h3>No letters issued yet</h3><p>Generated appointment, experience, employment, promotion, and relieving letters will appear here.</p></div>}
    </section>

    <section className="student-panel employee-documents-register">
      <div className="student-panel-heading">
        <div><h2>Document register</h2><span>Private employee documents and verification status</span></div>
        <span>{rows.length} records</span>
      </div>
      <form className="student-filters employee-documents-filter" method="get">
        <label>Search<input name="search" defaultValue={params.search ?? ""} placeholder="Employee, code, or file name" /></label>
        <label>Employee type<select name="type" defaultValue={type}><option value="all">All employees</option><option value="teacher">Teachers</option><option value="staff">Staff</option></select></label>
        <label>Verification status<select name="status" defaultValue={status}><option value="all">All statuses</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Needs replacement</option></select></label>
        <button type="submit">Filter documents</button>
      </form>
      {documentsWithLinks.length ? <div className="student-table-wrap">
        <table className="student-table">
          <thead><tr><th>Employee</th><th>Document</th><th>File</th><th>Uploaded</th><th>Status</th><th>Review</th></tr></thead>
          <tbody>{documentsWithLinks.map((document) => <tr key={document.id}>
            <td>
              <Link className="employee-document-person" href={`/${document.employee_type === "teacher" ? "teachers" : "staff"}/${document.employee_id}`}>
                <strong>{document.employee ? `${document.employee.first_name} ${document.employee.last_name}` : "Employee record"}</strong>
                <small>{document.employee?.employee_code ?? "Profile unavailable"} · {document.employee_type}</small>
              </Link>
            </td>
            <td>{document.label}</td>
            <td><a className="text-action employee-document-file" href={document.url} target="_blank" rel="noreferrer">{document.original_name}<small>{(document.file_size / 1024 / 1024).toFixed(2)} MB · {document.content_type}</small></a></td>
            <td>{formatDate(document.created_at)}</td>
            <td><span className={`employee-document-status employee-document-status--${document.status}`}>{document.status === "rejected" ? "Needs replacement" : document.status === "verified" ? "Verified" : "Pending"}</span></td>
            <td>{canManage
              ? <EmployeeVerificationReviewForm
                  employeeId={document.employee_id}
                  employeeType={document.employee_type}
                  documentId={document.id}
                  status={document.status}
                />
              : <span className="employee-document-review-readonly">{document.status === "pending" ? "Awaiting review" : "—"}</span>}</td>
          </tr>)}</tbody>
        </table>
      </div> : <div className="student-empty"><h3>{rows.length ? "No documents match these filters" : "No employee documents yet"}</h3><p>{rows.length ? "Adjust the search or filters to find employee records." : "Uploaded identity, qualification, experience, and police verification files will appear here."}</p></div>}
    </section>
  </main>;
}
