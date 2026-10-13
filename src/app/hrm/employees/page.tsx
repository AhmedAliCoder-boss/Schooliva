import Link from "next/link";

import { requireHrmContext } from "@/lib/hrm/context";

type SearchParams = Promise<{ search?: string; type?: string; status?: string }>;
type EmployeeRow = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string | null;
  department?: string | null;
  designation?: string | null;
  specialization?: string | null;
  employment_status: string;
  type: "teacher" | "staff";
};

export default async function HrmEmployeesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, schoolId } = await requireHrmContext("view");
  const search = params.search?.trim() ?? "";
  const type = params.type === "teacher" || params.type === "staff" ? params.type : "all";
  const status = params.status ?? "active";
  const queries = [
    ...(type !== "staff" ? [(() => {
      let query = supabase.from("teachers")
        .select("id,employee_code,first_name,last_name,email,specialization,employment_status")
        .eq("school_id", schoolId).order("last_name").limit(250);
      if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_code.ilike.%${search}%`);
      if (status !== "all") query = query.eq("employment_status", status);
      return query;
    })()] : []),
    ...(type !== "teacher" ? [(() => {
      let query = supabase.from("staff")
        .select("id,employee_code,first_name,last_name,email,department,designation,employment_status")
        .eq("school_id", schoolId).order("last_name").limit(250);
      if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_code.ilike.%${search}%`);
      if (status !== "all") query = query.eq("employment_status", status);
      return query;
    })()] : []),
  ] as const;
  const results = await Promise.all(queries);
  if (results.some((result) => result.error)) throw new Error("Employee records could not be loaded.");
  const teacherRows = type === "staff" ? [] : (results[0]?.data ?? []).map((row) => ({ ...row, type: "teacher" as const }));
  const staffResultIndex = type === "teacher" ? 0 : type === "all" ? 1 : 0;
  const staffRows = type === "teacher" ? [] : (results[staffResultIndex]?.data ?? []).map((row) => ({ ...row, type: "staff" as const }));
  const employees = [...teacherRows, ...staffRows] as EmployeeRow[];

  return <main className="students-shell hrm-shell">
    <section className="module-page-header">
      <div><p className="module-page-header__eyebrow">HRM / Employee records</p><h1>Employees.</h1>
        <p>Teacher and staff records are created through the hiring workflow and managed here.</p></div>
    </section>
    <form className="student-filters">
      <label>Search<input name="search" defaultValue={search} placeholder="Name or employee code" /></label>
      <label>Employee type<select name="type" defaultValue={type}><option value="all">Teachers and staff</option><option value="teacher">Teachers</option><option value="staff">Staff</option></select></label>
      <label>Status<select name="status" defaultValue={status}><option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On leave</option><option value="terminated">Terminated</option><option value="all">All statuses</option></select></label>
      <button type="submit">Filter</button>
    </form>
    <div className="student-table-wrap"><table className="student-table">
      <thead><tr><th>Employee</th><th>Employee code</th><th>Type / role</th><th>Contact</th><th>Status</th></tr></thead>
      <tbody>{employees.length ? employees.map((employee) => {
        const profilePath = employee.type === "teacher" ? `/teachers/${employee.id}` : `/staff/${employee.id}`;
        const role = employee.type === "teacher" ? employee.specialization ?? "Teacher" : employee.designation ?? "Staff";
        return <tr key={`${employee.type}-${employee.id}`}>
          <td><Link href={profilePath} className="student-name"><strong>{employee.first_name} {employee.last_name}</strong><small>Open profile</small></Link></td>
          <td>{employee.employee_code}</td>
          <td><span>{employee.type === "teacher" ? "Teacher" : "Staff"}</span><small>{role}</small></td>
          <td>{employee.email ?? "-"}</td>
          <td><span className={`status-pill ${employee.employment_status}`}>{employee.employment_status.replaceAll("_", " ")}</span></td>
        </tr>;
      }) : <tr><td colSpan={5}><div className="student-empty"><h3>No employees found</h3><p>Complete a candidate hire to create a teacher or staff record and login account.</p><Link href="/hrm/candidates">Go to candidates →</Link></div></td></tr>}</tbody>
    </table></div>
  </main>;
}
