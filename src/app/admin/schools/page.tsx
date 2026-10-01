import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { requireMasterAdmin } from "@/lib/admin/guard";

export default async function AdminSchoolsPage({ searchParams }: { searchParams: Promise<{ search?: string; status?: string; page?: string }> }) {
  const params = await searchParams;
  const { supabase } = await requireMasterAdmin();
  const search = String(params.search ?? "").trim();
  const status = String(params.status ?? "all");
  const page = Math.max(1, Number(params.page ?? 1));
  const pageSize = 12;
  let schoolQuery = supabase.from("schools").select("id,name,code,email,phone,is_active,created_at", { count: "exact" });
  if (search) schoolQuery = schoolQuery.or(`name.ilike.%${search}%,code.ilike.%${search}%,email.ilike.%${search}%`);
  if (status !== "all") schoolQuery = schoolQuery.eq("is_active", status === "active");
  const [{ data: schools, count }, { data: memberships }, { data: students }, { data: documents }] = await Promise.all([
    schoolQuery.order("name").range((page - 1) * pageSize, page * pageSize - 1),
    supabase.from("user_roles").select("school_id,user_id"),
    supabase.from("students").select("id,school_id"),
    supabase.from("school_documents").select("school_id,file_size"),
  ]);
  const accountCount = (schoolId: string) => new Set((memberships ?? []).filter((row) => row.school_id === schoolId).map((row) => row.user_id)).size;
  const studentCount = (schoolId: string) => (students ?? []).filter((row) => row.school_id === schoolId).length;
  const storage = (schoolId: string) => (documents ?? []).filter((row) => row.school_id === schoolId).reduce((sum, row) => sum + Number(row.file_size ?? 0), 0);
  const formatBytes = (value: number) => value > 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.round(value / 1024)} KB`;
  const href = (nextPage: number) => `/admin/schools?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&page=${nextPage}`;

  return <AdminShell title="Schools" description="The central tenant portfolio. Select a school to inspect its environment or explicitly open its existing dashboard." breadcrumbs={[{ label: "Schools" }]}>
    <section className="admin-toolbar"><div><span className="admin-toolbar__count">{count ?? 0} schools</span><span className="admin-toolbar__hint">Global platform portfolio</span></div><Link href="/admin/schools/new" className="admin-button admin-button--primary">+ Create school</Link></section>
    <form className="admin-filters" method="get"><input name="search" defaultValue={search} placeholder="Search schools, code or email" /><select name="status" defaultValue={status}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select><button className="admin-button" type="submit">Filter</button></form>
    <section className="admin-panel admin-panel--flush"><div className="admin-table-wrap"><table className="admin-table admin-table--wide"><thead><tr><th>School</th><th>Code</th><th>Status</th><th>Accounts</th><th>Students</th><th>Storage recorded</th><th>Created</th><th>Actions</th></tr></thead><tbody>{(schools ?? []).map((school) => <tr key={school.id}><td><Link className="admin-table__primary" href={`/admin/schools/${school.id}`}>{school.name}</Link><small>{school.email ?? school.phone ?? "No contact"}</small></td><td>{school.code}</td><td><span className={`admin-badge ${school.is_active ? "admin-badge--positive" : "admin-badge--warning"}`}>{school.is_active ? "Active" : "Inactive"}</span></td><td>{accountCount(String(school.id))}</td><td>{studentCount(String(school.id))}</td><td>{formatBytes(storage(String(school.id)))}</td><td>{new Date(String(school.created_at)).toLocaleDateString()}</td><td><div className="admin-row-actions"><Link href={`/admin/schools/${school.id}`}>Manage</Link><Link href={`/admin/schools/${school.id}/dashboard`}>Open dashboard</Link></div></td></tr>)}{!(schools ?? []).length && <tr><td colSpan={8}><div className="admin-empty"><strong>No schools match this filter.</strong><span>Try a different search or status.</span></div></td></tr>}</tbody></table></div></section>
    {(count ?? 0) > pageSize && <div className="admin-pagination"><span>Page {page}</span><div>{page > 1 && <Link href={href(page - 1)}>← Previous</Link>}{page * pageSize < (count ?? 0) && <Link href={href(page + 1)}>Next →</Link>}</div></div>}
  </AdminShell>;
}
