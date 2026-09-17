import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DriverForm, RouteForm, StopForm, StudentAssignmentForm, TransportFeeForm, VehicleForm } from "@/components/transport/transport-forms";

function relation<T>(value: unknown): T | null { return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null; }

export default async function TransportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { data: membership } = await supabase.from("user_roles").select("school_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership?.school_id) redirect("/setup?onboarding=1");
  const schoolId = membership.school_id as string;

  const [{ data: drivers }, { data: vehicles }, { data: routes }, { data: stops }, { data: assignments }, { data: fees }, { data: students }] = await Promise.all([
    supabase.from("transport_drivers").select("id,full_name,license_number,status").eq("school_id", schoolId).order("full_name"),
    supabase.from("transport_vehicles").select("id,registration_number,vehicle_type,capacity,status,driver_id").eq("school_id", schoolId).order("registration_number"),
    supabase.from("transport_routes").select("id,name,route_code,status,vehicle_id").eq("school_id", schoolId).order("name"),
    supabase.from("transport_stops").select("id,name,stop_type").eq("school_id", schoolId).order("name"),
    supabase.from("transport_student_assignments").select("id,student_id,route_id,status,pickup_stop_id,dropoff_stop_id,students(first_name,last_name,admission_number),transport_routes(name),pickup_stop(name),dropoff_stop(name)").eq("school_id", schoolId).order("assigned_on", { ascending: false }),
    supabase.from("transport_fees").select("id,amount,frequency,due_day,student_id,route_id").eq("school_id", schoolId).order("amount", { ascending: false }),
    supabase.from("students").select("id,first_name,last_name,admission_number").eq("school_id", schoolId).eq("is_active", true).order("last_name"),
  ]);

  const driverOptions = (drivers ?? []).map((item) => ({ id: String(item.id), name: `${String(item.full_name)} (${String(item.status)})` }));
  const vehicleOptions = (vehicles ?? []).map((item) => ({ id: String(item.id), name: `${String(item.registration_number)} · ${String(item.capacity)} seats` }));
  const routeOptions = (routes ?? []).map((item) => ({ id: String(item.id), name: `${String(item.name)} (${String(item.route_code)})` }));
  const stopOptions = (stops ?? []).map((item) => ({ id: String(item.id), name: `${String(item.name)} · ${String(item.stop_type)}` }));
  const studentOptions = (students ?? []).map((item) => ({ id: String(item.id), name: `${String(item.first_name ?? "")} ${String(item.last_name ?? "")} (${String(item.admission_number ?? "-")})`.trim() }));

  return <main className="students-shell">
    <header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/dashboard">Dashboard -&gt;</Link></header>
    <section className="students-heading"><div><p className="eyebrow">Transport</p><h1>Vehicles, routes, and capacity.</h1><p>Assign students to routes while respecting vehicle capacity and route stop logic.</p></div></section>
    <section className="setup-card"><h3>Transport fleet</h3><DriverForm /><VehicleForm drivers={driverOptions} /><RouteForm vehicles={vehicleOptions} /><StopForm /></section>
    <section className="setup-card"><h3>Assignments</h3><StudentAssignmentForm students={studentOptions} routes={routeOptions} stops={stopOptions} /><TransportFeeForm students={studentOptions} routes={routeOptions} /></section>
    <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Student</th><th>Route</th><th>Pickup</th><th>Drop-off</th><th>Status</th></tr></thead><tbody>{(assignments ?? []).length ? (assignments ?? []).map((assignment) => { const student = relation<{ first_name: string; last_name: string; admission_number: string }>(assignment.students); const route = relation<{ name: string }>(assignment.transport_routes); const pickup = relation<{ name: string }>(assignment.pickup_stop); const dropoff = relation<{ name: string }>(assignment.dropoff_stop); return <tr key={String(assignment.id)}><td>{student ? `${student.first_name} ${student.last_name}` : "-"}</td><td>{route?.name ?? "-"}</td><td>{pickup?.name ?? "-"}</td><td>{dropoff?.name ?? "-"}</td><td><span className={`status-pill ${String(assignment.status)}`}>{String(assignment.status)}</span></td></tr>; }) : <tr><td colSpan={5}><div className="student-empty"><h3>No assignments yet</h3><p>Route assignments will appear here once students are assigned.</p></div></td></tr>}</tbody></table></div>
    <div className="student-table-wrap" style={{ marginTop: 24 }}><table className="student-table"><thead><tr><th>Student</th><th>Route</th><th>Amount</th><th>Frequency</th><th>Due day</th></tr></thead><tbody>{(fees ?? []).length ? (fees ?? []).map((fee) => <tr key={String(fee.id)}><td>{String(fee.student_id)}</td><td>{String(fee.route_id)}</td><td>{String(fee.amount)}</td><td>{String(fee.frequency)}</td><td>{String(fee.due_day)}</td></tr>) : <tr><td colSpan={5}><div className="student-empty"><h3>No transport fees</h3><p>Transport fee assignments will appear here.</p></div></td></tr>}</tbody></table></div>
  </main>;
}
