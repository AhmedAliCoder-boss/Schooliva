"use client";

import { useMemo, useState } from "react";

import { AssignmentStatusForm, DriverStatusForm, VehicleStatusForm } from "@/components/transport/transport-forms";

export type TransportVehicleRow = {
  id: string;
  registrationNumber: string;
  vehicleType: string;
  capacity: number;
  status: string;
  driverName: string;
  routes: string[];
};

export type TransportStopRow = {
  id: string;
  name: string;
  type: string;
  address: string;
  order: number;
  pickupTime: string;
  dropoffTime: string;
};

export type TransportRouteRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  vehicleName: string;
  vehicleStatus: string;
  capacity: number;
  assignedStudents: number;
  stops: TransportStopRow[];
};

export type TransportAssignmentRow = {
  id: string;
  studentName: string;
  admissionNumber: string;
  routeName: string;
  routeCode: string;
  pickupStop: string;
  dropoffStop: string;
  status: string;
  assignedOn: string;
  notes: string;
};

export type TransportFeeRow = {
  id: string;
  studentName: string;
  admissionNumber: string;
  routeName: string;
  amount: string;
  frequency: string;
  dueDay: number;
  isActive: boolean;
};

type Tab = "fleet" | "routes" | "assignments" | "fees";
type Filter = "all" | "active" | "inactive" | "maintenance" | "on_leave";

function Status({ value }: { value: string }) {
  return <span className={`transport-status transport-status--${value}`}>{value.replaceAll("_", " ")}</span>;
}

export function TransportRegister({
  vehicles,
  drivers,
  routes,
  assignments,
  fees,
  canManage,
}: {
  vehicles: TransportVehicleRow[];
  drivers: Array<{ id: string; name: string; licenseNumber: string; phone: string; status: string }>;
  routes: TransportRouteRow[];
  assignments: TransportAssignmentRow[];
  fees: TransportFeeRow[];
  canManage: boolean;
}) {
  const [tab, setTab] = useState<Tab>("fleet");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredVehicles = useMemo(() => vehicles.filter((vehicle) => {
    const matches = `${vehicle.registrationNumber} ${vehicle.vehicleType} ${vehicle.driverName} ${vehicle.routes.join(" ")}`.toLocaleLowerCase().includes(normalizedQuery);
    return matches && (filter === "all" || vehicle.status === filter);
  }), [vehicles, filter, normalizedQuery]);
  const filteredDrivers = useMemo(() => drivers.filter((driver) => `${driver.name} ${driver.licenseNumber} ${driver.phone}`.toLocaleLowerCase().includes(normalizedQuery)
    && (filter === "all" || driver.status === filter)), [drivers, filter, normalizedQuery]);
  const filteredRoutes = useMemo(() => routes.filter((route) =>
    `${route.name} ${route.code} ${route.vehicleName} ${route.stops.map((stop) => stop.name).join(" ")}`.toLocaleLowerCase().includes(normalizedQuery)
    && (filter === "all" || route.status === filter)), [routes, filter, normalizedQuery]);
  const filteredAssignments = useMemo(() => assignments.filter((assignment) =>
    `${assignment.studentName} ${assignment.admissionNumber} ${assignment.routeName} ${assignment.routeCode} ${assignment.pickupStop} ${assignment.dropoffStop}`.toLocaleLowerCase().includes(normalizedQuery)
    && (filter === "all" || assignment.status === filter)), [assignments, filter, normalizedQuery]);
  const filteredFees = useMemo(() => fees.filter((fee) =>
    `${fee.studentName} ${fee.admissionNumber} ${fee.routeName} ${fee.frequency}`.toLocaleLowerCase().includes(normalizedQuery)
    && (filter === "all" || (filter === "active" ? fee.isActive : filter === "inactive" ? !fee.isActive : false))), [fees, filter, normalizedQuery]);
  const recordCount = tab === "fleet" ? vehicles.length + drivers.length : tab === "routes" ? routes.length : tab === "assignments" ? assignments.length : fees.length;
  const filterOptions = tab === "fleet"
    ? ["all", "active", "maintenance", "inactive", "on_leave"] as const
    : tab === "fees" ? ["all", "active", "inactive"] as const : ["all", "active", "inactive"] as const;

  function switchTab(next: Tab) {
    setTab(next);
    setFilter("all");
    setQuery("");
  }

  return <section className="transport-register" aria-label="Transport registers">
    <header className="transport-register__heading">
      <div><p className="module-page-header__eyebrow">Operations register</p><h2>Fleet, routes and ridership</h2><p>Search records, check capacity, review stop sequences, and manage current assignments.</p></div>
      <span>{recordCount} {tab === "fleet" ? "fleet records" : tab === "routes" ? "routes" : tab === "assignments" ? "assignments" : "fee plans"}</span>
    </header>
    <div className="transport-register__toolbar">
      <div className="transport-register__tabs" role="tablist" aria-label="Transport records">
        <button type="button" role="tab" aria-selected={tab === "fleet"} className={tab === "fleet" ? "active" : ""} onClick={() => switchTab("fleet")}>Fleet</button>
        <button type="button" role="tab" aria-selected={tab === "routes"} className={tab === "routes" ? "active" : ""} onClick={() => switchTab("routes")}>Routes &amp; stops</button>
        <button type="button" role="tab" aria-selected={tab === "assignments"} className={tab === "assignments" ? "active" : ""} onClick={() => switchTab("assignments")}>Students</button>
        <button type="button" role="tab" aria-selected={tab === "fees"} className={tab === "fees" ? "active" : ""} onClick={() => switchTab("fees")}>Fee plans</button>
      </div>
      <label className="transport-register__search"><span className="sr-only">Search transport records</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "fleet" ? "Search vehicle, driver, route…" : tab === "routes" ? "Search route or stop…" : tab === "assignments" ? "Search student, ID, route…" : "Search student or route…"}/></label>
    </div>
    <div className="transport-register__filters" role="group" aria-label="Filter transport records">
      {filterOptions.map((option) => <button type="button" key={option} className={filter === option ? "active" : ""} aria-pressed={filter === option} onClick={() => setFilter(option)}>{option === "all" ? "All" : option.replaceAll("_", " ")}</button>)}
    </div>
    {tab === "fleet" && <div className="transport-fleet-grid">
      {filteredVehicles.map((vehicle) => <article className="transport-vehicle-card" key={vehicle.id}>
          <div className="transport-vehicle-card__top"><span className="transport-vehicle-card__icon" aria-hidden="true">↗</span><Status value={vehicle.status} /></div>
          <p>{vehicle.vehicleType}</p><h3>{vehicle.registrationNumber}</h3>
          <div className="transport-vehicle-card__driver"><span>Assigned driver</span><strong>{vehicle.driverName || "Not assigned"}</strong></div>
          <div className="transport-capacity"><div><span>Vehicle capacity</span><strong>{vehicle.capacity} seats</strong></div><small>{vehicle.routes.length} assigned {vehicle.routes.length === 1 ? "route" : "routes"}; capacity checks are shown per route.</small></div>
          <div className="transport-vehicle-card__routes"><span>Routes</span><strong>{vehicle.routes.length ? vehicle.routes.join(", ") : "No route assigned"}</strong></div>
          {canManage && <VehicleStatusForm vehicleId={vehicle.id} status={vehicle.status} />}
        </article>)}
      {filteredDrivers.map((driver) => <article className="transport-driver-card" key={driver.id}>
        <div className="transport-driver-card__top"><span className="transport-driver-card__avatar">{driver.name.trim().slice(0, 1).toUpperCase()}</span><Status value={driver.status} /></div>
        <h3>{driver.name}</h3><p>License {driver.licenseNumber}</p><small>{driver.phone || "No phone recorded"}</small>
        {canManage && <DriverStatusForm driverId={driver.id} status={driver.status} />}
      </article>)}
      {!filteredVehicles.length && !filteredDrivers.length && <Empty message="No fleet or driver records match this search." />}
    </div>}
    {tab === "routes" && <div className="transport-route-list">
      {filteredRoutes.length ? filteredRoutes.map((route) => <article className="transport-route-card" key={route.id}>
        <header className="transport-route-card__heading"><div><span>{route.code}</span><h3>{route.name}</h3></div><Status value={route.status} /></header>
        <div className="transport-route-card__summary"><span>Vehicle<strong>{route.vehicleName || "Not assigned"}</strong><Status value={route.vehicleStatus} /></span><span>Riders<strong>{route.assignedStudents} / {route.capacity || "—"} seats</strong></span><span>Stops<strong>{route.stops.length}</strong></span></div>
        {route.stops.length ? <ol className="transport-route-timeline">{route.stops.map((stop) => <li key={stop.id}><span className="transport-route-timeline__point" /><div><strong>{stop.name}</strong>{stop.address && <small>{stop.address}</small>}<span>{stop.pickupTime && `Pickup ${stop.pickupTime}`}{stop.pickupTime && stop.dropoffTime && " · "}{stop.dropoffTime && `Drop-off ${stop.dropoffTime}`}{!stop.pickupTime && !stop.dropoffTime && stop.type.replaceAll("_", " ")}</span></div><small>Stop {stop.order}</small></li>)}</ol> : <p className="transport-route-card__empty">No stops in sequence yet. Use Build route to add them.</p>}
      </article>) : <Empty message="No routes match this search." />}
    </div>}
    {tab === "assignments" && <div className="transport-assignment-list">
      {filteredAssignments.length ? filteredAssignments.map((assignment) => <article className="transport-assignment-card" key={assignment.id}>
        <div className="transport-assignment-card__student"><span className="transport-assignment-card__avatar">{assignment.studentName.trim().slice(0, 1).toUpperCase()}</span><div><h3>{assignment.studentName}</h3><p>{assignment.admissionNumber} <i>·</i> Assigned {assignment.assignedOn}</p></div><Status value={assignment.status} /></div>
        <div className="transport-assignment-card__route"><span>Route</span><strong>{assignment.routeName} <small>{assignment.routeCode}</small></strong></div>
        <div className="transport-assignment-card__stops"><span>Pickup</span><strong>{assignment.pickupStop || "Not set"}</strong><span>Drop-off</span><strong>{assignment.dropoffStop || "Not set"}</strong></div>
        {assignment.notes && <p className="transport-assignment-card__notes">{assignment.notes}</p>}
        {canManage && <AssignmentStatusForm assignmentId={assignment.id} status={assignment.status} />}
      </article>) : <Empty message="No student assignments match this search." />}
    </div>}
    {tab === "fees" && <div className="transport-fee-list">
      {filteredFees.length ? filteredFees.map((fee) => <article className="transport-fee-card" key={fee.id}>
        <div><span>Student</span><h3>{fee.studentName}</h3><small>{fee.admissionNumber}</small></div>
        <div><span>Route</span><strong>{fee.routeName}</strong></div>
        <div><span>Transport fee</span><strong>{fee.amount}</strong></div>
        <div><span>Billing schedule</span><strong>{fee.frequency} · due day {fee.dueDay}</strong></div>
        <Status value={fee.isActive ? "active" : "inactive"} />
      </article>) : <Empty message="No transport fee plans match this search." />}
    </div>}
    {!canManage && <p className="transport-read-only">You have read-only access to transport records.</p>}
  </section>;
}

function Empty({ message }: { message: string }) {
  return <div className="transport-empty"><h3>No matching records</h3><p>{message}</p></div>;
}
