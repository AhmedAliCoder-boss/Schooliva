"use client";

import { useState } from "react";

import {
  DriverForm,
  RouteForm,
  RouteStopForm,
  StopForm,
  StudentAssignmentForm,
  TransportFeeForm,
  VehicleForm,
} from "@/components/transport/transport-forms";

type Option = { id: string; name: string };
type TabId = "driver" | "vehicle" | "route" | "route-stop" | "stop" | "assignment" | "fee";

export function TransportActionsPanel({
  drivers,
  vehicles,
  routes,
  stops,
  students,
  routeStops,
}: {
  drivers: Option[];
  vehicles: Option[];
  routes: Option[];
  stops: Option[];
  students: Option[];
  routeStops: Array<Option & { routeId: string; type: string }>;
}) {
  const tabs: Array<{ id: TabId; label: string; description: string }> = [
    { id: "assignment", label: "Assign student", description: "Choose an active student, a route with available seats, and optional route stops." },
    { id: "route-stop", label: "Build route", description: "Add stops in travel order and set pickup or drop-off times." },
    { id: "vehicle", label: "Add vehicle", description: "Register a vehicle, seat capacity, driver, and operating status." },
    { id: "route", label: "Add route", description: "Create a route and optionally assign an available vehicle." },
    { id: "driver", label: "Add driver", description: "Maintain driver contact and license details." },
    { id: "stop", label: "Add stop", description: "Create a reusable pickup, drop-off, or combined stop." },
    { id: "fee", label: "Set route fee", description: "Configure a student's transport amount, billing cadence, and due day." },
  ];
  const [activeTab, setActiveTab] = useState<TabId>("assignment");
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  function renderForm() {
    switch (activeTab) {
      case "assignment":
        return <StudentAssignmentForm students={students} routes={routes} routeStops={routeStops} />;
      case "route-stop":
        return <RouteStopForm routes={routes} stops={stops} />;
      case "vehicle":
        return <VehicleForm drivers={drivers} />;
      case "route":
        return <RouteForm vehicles={vehicles} />;
      case "driver":
        return <DriverForm />;
      case "stop":
        return <StopForm />;
      case "fee":
        return <TransportFeeForm students={students} routes={routes} />;
    }
  }

  return <section className="transport-actions" id="transport-actions" aria-label="Transport workflows">
    <div className="transport-action-tabs" role="tablist" aria-label="Choose a transport workflow">
      {tabs.map((tab, index) => <button
        key={tab.id}
        id={`transport-action-tab-${tab.id}`}
        type="button"
        role="tab"
        aria-selected={activeTab === tab.id}
        aria-controls="transport-action-panel"
        className={activeTab === tab.id ? "active" : ""}
        onClick={() => setActiveTab(tab.id)}
      ><span>{String(index + 1).padStart(2, "0")}</span>{tab.label}</button>)}
    </div>
    <div className="transport-action-panel" id="transport-action-panel" role="tabpanel" aria-labelledby={`transport-action-tab-${active.id}`} key={active.id}>
      <div className="transport-action-panel__heading"><div><h2>{active.label}</h2><p>{active.description}</p></div><span>{tabs.findIndex((tab) => tab.id === active.id) + 1} / {tabs.length}</span></div>
      {renderForm()}
    </div>
  </section>;
}
