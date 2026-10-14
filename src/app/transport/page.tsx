import Link from "next/link";
import { redirect } from "next/navigation";

import { TransportActionsPanel } from "@/components/transport/transport-actions-panel";
import {
  TransportRegister,
  type TransportAssignmentRow,
  type TransportFeeRow,
  type TransportRouteRow,
  type TransportStopRow,
  type TransportVehicleRow,
} from "@/components/transport/transport-register";
import { ProgressWheel } from "@/components/progress-wheel";
import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { parseTransportStudentOptions } from "@/lib/transport/student-options";
import { createClient } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;
type RelatedName = { id?: string; name: string | null; stop_type?: string | null; address?: string | null };
type RelatedStudent = { first_name: string | null; last_name: string | null; admission_number: string | null };

function queryError(error: { code?: string; message?: string; details?: string; hint?: string } | null) {
  if (!error) return null;
  return {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  };
}

function relation<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function dateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export default async function TransportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { schoolId, isMasterAdmin } = await getActiveSchoolContext(supabase, user.id);
  if (!schoolId) redirect(isMasterAdmin ? "/admin" : "/setup?onboarding=1");

  const { data: canManage, error: managePermissionError } = await supabase.rpc("has_permission", {
    target_school_id: schoolId,
    target_resource: "transport",
    target_action: "manage",
  });
  if (managePermissionError) {
    console.error("Transport manage permission could not be checked.", managePermissionError);
    throw new Error("Transport permissions could not be verified.");
  }

  const [
    { data: settings, error: settingsError },
    { data: driverRecords, error: driversError },
    { data: vehicleRecords, error: vehiclesError },
    { data: routeRecords, error: routesError },
    { data: stopRecords, error: stopsError },
    { data: routeStopRecords, error: routeStopsError },
    { data: assignmentRecords, error: assignmentsError },
    { data: feeRecords, error: feesError },
  ] = await Promise.all([
    supabase.from("school_settings").select("currency_code,locale").eq("school_id", schoolId).maybeSingle(),
    supabase.from("transport_drivers").select("id,full_name,license_number,phone,status").eq("school_id", schoolId).order("full_name").limit(1000),
    supabase.from("transport_vehicles").select("id,registration_number,vehicle_type,capacity,status,driver_id").eq("school_id", schoolId).order("registration_number").limit(1000),
    supabase.from("transport_routes").select("id,name,route_code,status,vehicle_id").eq("school_id", schoolId).order("name").limit(1000),
    supabase.from("transport_stops").select("id,name,stop_type,address").eq("school_id", schoolId).order("name").limit(2000),
    supabase.from("transport_route_stops").select("id,route_id,stop_id,stop_order,pickup_time,dropoff_time,transport_stops(id,name,stop_type,address)").eq("school_id", schoolId).order("stop_order").limit(5000),
    supabase.from("transport_student_assignments").select("id,student_id,route_id,status,pickup_stop_id,dropoff_stop_id,assigned_on,notes,students(first_name,last_name,admission_number),transport_routes(name,route_code),pickup_stop:transport_stops!transport_student_assignments_pickup_stop_id_fkey(name),dropoff_stop:transport_stops!transport_student_assignments_dropoff_stop_id_fkey(name)").eq("school_id", schoolId).order("assigned_on", { ascending: false }).limit(5000),
    supabase.from("transport_fees").select("id,amount,frequency,due_day,student_id,route_id,is_active,students(first_name,last_name,admission_number),transport_routes(name)").eq("school_id", schoolId).order("amount", { ascending: false }).limit(5000),
  ]);
  if (settingsError || driversError || vehiclesError || routesError || stopsError || routeStopsError || assignmentsError || feesError) {
    console.error("Transport workspace data could not be loaded.", {
      settingsError: queryError(settingsError),
      driversError: queryError(driversError),
      vehiclesError: queryError(vehiclesError),
      routesError: queryError(routesError),
      stopsError: queryError(stopsError),
      routeStopsError: queryError(routeStopsError),
      assignmentsError: queryError(assignmentsError),
      feesError: queryError(feesError),
    });
    throw new Error("Transport workspace data could not be loaded.");
  }
  const { data: studentRecords, error: studentsError } = canManage
    ? await supabase.rpc("transport_students_for_assignment", { target_school_id: schoolId })
    : await supabase.from("students").select("id,first_name,last_name,admission_number").eq("school_id", schoolId).eq("is_active", true).order("last_name").limit(5000);
  if (studentsError) {
    console.error("Transport student options could not be loaded.", studentsError);
    throw new Error("Transport student options could not be loaded.");
  }
  if (!settings) {
    console.error("Transport currency settings are not configured.", { schoolId });
    throw new Error("School currency settings must be configured before transport fees can be displayed.");
  }

  const currencyFormatter = new Intl.NumberFormat(settings.locale.trim(), {
    style: "currency",
    currency: settings.currency_code.trim(),
    maximumFractionDigits: 2,
  });
  const drivers = driverRecords ?? [];
  const vehicles = vehicleRecords ?? [];
  const routes = routeRecords ?? [];
  const stops = stopRecords ?? [];
  const assignments = assignmentRecords ?? [];
  const fees = feeRecords ?? [];
  const students = parseTransportStudentOptions(studentRecords);

  const driverById = new Map(drivers.map((driver) => [String(driver.id), driver]));
  const vehicleById = new Map(vehicles.map((vehicle) => [String(vehicle.id), vehicle]));
  const activeAssignmentsByRoute = new Map<string, number>();
  for (const assignment of assignments) {
    if (assignment.status === "active") {
      const routeId = String(assignment.route_id);
      activeAssignmentsByRoute.set(routeId, (activeAssignmentsByRoute.get(routeId) ?? 0) + 1);
    }
  }

  const stopsByRoute = new Map<string, TransportStopRow[]>();
  for (const record of routeStopRecords ?? []) {
    const stop = relation<RelatedName>(record.transport_stops);
    if (!stop) continue;
    const routeId = String(record.route_id);
    const routeStops = stopsByRoute.get(routeId) ?? [];
    routeStops.push({
      id: String(record.id),
      name: String(stop.name ?? "Unnamed stop"),
      type: String(stop.stop_type ?? "both"),
      address: String(stop.address ?? ""),
      order: Number(record.stop_order),
      pickupTime: String(record.pickup_time ?? "").slice(0, 5),
      dropoffTime: String(record.dropoff_time ?? "").slice(0, 5),
    });
    stopsByRoute.set(routeId, routeStops);
  }

  const routeRows: TransportRouteRow[] = routes.map((route) => {
    const vehicle = route.vehicle_id ? vehicleById.get(String(route.vehicle_id)) : null;
    return {
      id: String(route.id),
      name: String(route.name),
      code: String(route.route_code),
      status: String(route.status),
      vehicleName: vehicle ? String(vehicle.registration_number) : "",
      vehicleStatus: vehicle ? String(vehicle.status) : "unassigned",
      capacity: vehicle ? Number(vehicle.capacity) : 0,
      assignedStudents: activeAssignmentsByRoute.get(String(route.id)) ?? 0,
      stops: (stopsByRoute.get(String(route.id)) ?? []).sort((a, b) => a.order - b.order),
    };
  });
  const routeById = new Map(routeRows.map((route) => [route.id, route]));
  const routeRowsByVehicle = new Map<string, TransportRouteRow[]>();
  for (const routeRecord of routes) {
    if (!routeRecord.vehicle_id) continue;
    const vehicleRoutes = routeRowsByVehicle.get(String(routeRecord.vehicle_id)) ?? [];
    const routeRow = routeById.get(String(routeRecord.id));
    if (routeRow) vehicleRoutes.push(routeRow);
    routeRowsByVehicle.set(String(routeRecord.vehicle_id), vehicleRoutes);
  }

  const vehicleRows: TransportVehicleRow[] = vehicles.map((vehicle) => {
    const vehicleRoutes = routeRowsByVehicle.get(String(vehicle.id)) ?? [];
    return {
      id: String(vehicle.id),
      registrationNumber: String(vehicle.registration_number),
      vehicleType: String(vehicle.vehicle_type),
      capacity: Number(vehicle.capacity),
      status: String(vehicle.status),
      driverName: vehicle.driver_id ? String(driverById.get(String(vehicle.driver_id))?.full_name ?? "") : "",
      routes: vehicleRoutes.map((route) => route.name),
    };
  });
  const assignmentRows: TransportAssignmentRow[] = assignments.map((assignment) => {
    const student = relation<RelatedStudent>(assignment.students);
    const route = relation<{ name: string | null; route_code: string | null }>(assignment.transport_routes);
    const pickup = relation<{ name: string | null }>(assignment.pickup_stop);
    const dropoff = relation<{ name: string | null }>(assignment.dropoff_stop);
    return {
      id: String(assignment.id),
      studentName: `${student?.first_name ?? ""} ${student?.last_name ?? ""}`.trim() || "Unknown student",
      admissionNumber: String(student?.admission_number ?? "No student ID"),
      routeName: String(route?.name ?? "Unknown route"),
      routeCode: String(route?.route_code ?? ""),
      pickupStop: String(pickup?.name ?? ""),
      dropoffStop: String(dropoff?.name ?? ""),
      status: String(assignment.status),
      assignedOn: dateOnly(String(assignment.assigned_on)),
      notes: String(assignment.notes ?? ""),
    };
  });
  const feeRows: TransportFeeRow[] = fees.map((fee) => {
    const student = relation<RelatedStudent>(fee.students);
    const route = relation<{ name: string | null }>(fee.transport_routes);
    return {
      id: String(fee.id),
      studentName: `${student?.first_name ?? ""} ${student?.last_name ?? ""}`.trim() || "Unknown student",
      admissionNumber: String(student?.admission_number ?? "No student ID"),
      routeName: String(route?.name ?? "Unknown route"),
      amount: currencyFormatter.format(Number(fee.amount)),
      frequency: String(fee.frequency),
      dueDay: Number(fee.due_day),
      isActive: Boolean(fee.is_active),
    };
  });

  const activeVehicles = vehicles.filter((vehicle) => vehicle.status === "active");
  const activeRoutes = routeRows.filter((route) => route.status === "active" && route.vehicleStatus === "active");
  const serviceReadyRouteIds = new Set(activeRoutes.map((route) => route.id));
  const activeStudents = new Set(assignments
    .filter((assignment) => assignment.status === "active" && serviceReadyRouteIds.has(String(assignment.route_id)))
    .map((assignment) => String(assignment.student_id)));
  const activeCapacity = activeRoutes
    .filter((route) => route.vehicleStatus === "active")
    .reduce((sum, route) => sum + route.capacity, 0);
  const activeRiders = assignments.filter((assignment) => {
    const route = routeById.get(String(assignment.route_id));
    return assignment.status === "active" && route?.status === "active" && route.vehicleStatus === "active";
  }).length;
  const availableSeats = Math.max(0, activeCapacity - activeRiders);
  const capacityPercent = activeCapacity > 0 ? Math.min(100, Math.round(activeRiders / activeCapacity * 100)) : 0;

  const driverOptions = drivers.filter((driver) => driver.status === "active").map((driver) => ({
    id: String(driver.id),
    name: `${String(driver.full_name)} · ${String(driver.license_number)}`,
  }));
  const vehicleOptions = vehicles.filter((vehicle) => vehicle.status === "active").map((vehicle) => ({
    id: String(vehicle.id),
    name: `${String(vehicle.registration_number)} · ${String(vehicle.capacity)} seats`,
  }));
  const routeOptions = routeRows.filter((route) => route.status === "active"
    && route.vehicleStatus === "active"
    && route.capacity > route.assignedStudents).map((route) => ({
    id: route.id,
    name: `${route.name} (${route.code}) · ${route.capacity - route.assignedStudents} seats available`,
  }));
  const stopOptions = stops.map((stop) => ({ id: String(stop.id), name: `${String(stop.name)} · ${String(stop.stop_type)}` }));
  const routeStopOptions = (routeStopRecords ?? []).flatMap((record) => {
    const stop = relation<RelatedName>(record.transport_stops);
    return stop ? [{
      id: String(record.stop_id),
      routeId: String(record.route_id),
      name: String(stop.name ?? "Unnamed stop"),
      type: String(stop.stop_type ?? "both"),
    }] : [];
  });
  const studentOptions = students.map((student) => ({
    id: String(student.id),
    name: `${String(student.first_name ?? "")} ${String(student.last_name ?? "")} · ${String(student.admission_number ?? "No ID")}`.trim(),
  }));

  return <main className="students-shell transport-shell">
    <header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/dashboard">Dashboard -&gt;</Link></header>
    <section className="module-page-header transport-page-header"><div className="module-page-header__row"><div>
      <p className="module-page-header__eyebrow">Operations / Transport</p>
      <h1>Move every student safely.</h1>
      <p>Coordinate vehicles, drivers, route stop-times, student seats, and transport fee plans in one workspace.</p>
    </div>{canManage && <a className="transport-page-header__action" href="#transport-actions">+ Manage transport</a>}</div></section>

    <section className="module-kpi-grid transport-kpi-grid" aria-label="Transport operations summary">
      <article className="module-kpi transport-kpi"><span>Active vehicles</span><strong>{activeVehicles.length}</strong><small>{vehicles.length - activeVehicles.length} unavailable or in maintenance</small></article>
      <article className="module-kpi transport-kpi"><span>Service-ready routes</span><strong>{activeRoutes.length}</strong><small>{routeRows.reduce((sum, route) => sum + route.stops.length, 0)} scheduled route stops</small></article>
      <article className="module-kpi transport-kpi"><span>Assigned students</span><strong>{activeStudents.size}</strong><small>Active route assignments</small></article>
      <ProgressWheel label="Seat utilization" value={`${activeRiders} / ${activeCapacity}`} percentage={capacityPercent} color="#2563eb" detail={`${availableSeats} seats available on active routes`} />
      <article className="module-kpi transport-kpi"><span>Students without transport</span><strong>{students.filter((student) => !activeStudents.has(String(student.id))).length}</strong><small>Active students with no active route assignment</small></article>
    </section>

    {canManage && <TransportActionsPanel drivers={driverOptions} vehicles={vehicleOptions} routes={routeOptions} stops={stopOptions} students={studentOptions} routeStops={routeStopOptions} />}
    <TransportRegister vehicles={vehicleRows} drivers={drivers.map((driver) => ({
      id: String(driver.id),
      name: String(driver.full_name),
      licenseNumber: String(driver.license_number),
      phone: String(driver.phone ?? ""),
      status: String(driver.status),
    }))} routes={routeRows} assignments={assignmentRows} fees={feeRows} canManage={Boolean(canManage)} />
  </main>;
}
