"use client";

import { useState } from "react";

import {
  CafeteriaDailyMenuForm,
  CafeteriaMonthlyMenuForm,
  CafeteriaMenuItemForm,
  CafeteriaOrderForm,
  CafeteriaRecipeIngredientForm,
  CafeteriaStockItemForm,
  CafeteriaStockMovementForm,
  type CafeteriaOption,
  type CafeteriaMonthlyScheduleEntry,
  type CafeteriaOrderOption,
  type CafeteriaStockOption,
} from "@/components/cafeteria/cafeteria-forms";

type ActionTab = "item" | "daily-menu" | "monthly-menu" | "stock" | "movement" | "recipe" | "sale";

type Tab = {
  id: ActionTab;
  label: string;
  description: string;
};

const tabs: Tab[] = [
  { id: "item", label: "Add menu item", description: "Build a priced food and beverage catalog, including allergen notes." },
  { id: "daily-menu", label: "Plan daily menu", description: "Schedule portions by date and meal period with optional sales limits." },
  { id: "monthly-menu", label: "Plan monthly menu", description: "Schedule breakfast, lunch, and snacks across a full month and print the plan." },
  { id: "stock", label: "Add stock item", description: "Track ingredients, units, unit costs, and replenishment thresholds." },
  { id: "movement", label: "Record stock movement", description: "Receive purchases, issue stock, record waste, and reconcile quantities." },
  { id: "recipe", label: "Configure recipes", description: "Map each portion to ingredient quantities for automatic stock deduction." },
  { id: "sale", label: "Create meal order", description: "Accept today's scheduled items and record full or partial payment." },
];

export function CafeteriaActionsPanel({
  menuItems,
  orderableItems,
  stockItems,
  today,
  scheduledEntries,
  canManage,
}: {
  menuItems: CafeteriaOption[];
  orderableItems: CafeteriaOrderOption[];
  stockItems: CafeteriaStockOption[];
  today: string;
  scheduledEntries: CafeteriaMonthlyScheduleEntry[];
  canManage: boolean;
}) {
  const [activeTab, setActiveTab] = useState<ActionTab>("sale");
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  if (!canManage) {
    return <section className="cafeteria-actions cafeteria-actions--readonly" id="cafeteria-actions">
      <p className="cafeteria-readonly-note">You have read-only access to cafeteria operations.</p>
    </section>;
  }

  function renderForm() {
    switch (activeTab) {
      case "item": return <CafeteriaMenuItemForm />;
      case "daily-menu": return <CafeteriaDailyMenuForm menuItems={menuItems} today={today} />;
      case "monthly-menu": return <CafeteriaMonthlyMenuForm menuItems={menuItems} today={today} scheduledEntries={scheduledEntries} />;
      case "stock": return <CafeteriaStockItemForm />;
      case "movement": return <CafeteriaStockMovementForm stockItems={stockItems} />;
      case "recipe": return <CafeteriaRecipeIngredientForm menuItems={menuItems} stockItems={stockItems} />;
      case "sale": return <CafeteriaOrderForm menuItems={orderableItems} />;
    }
  }

  return <section className="cafeteria-actions" id="cafeteria-actions" aria-label="Food and cafeteria workflows">
    <div className="cafeteria-actions__intro">
      <div><p className="cafeteria-eyebrow">Operational workflows</p><h2>Run today’s cafeteria</h2><p>Set up the catalog and ingredients, schedule the menu, then accept orders and collect payments.</p></div>
      <span className="cafeteria-actions__today">{today}</span>
    </div>
    <div className="cafeteria-action-tabs" role="tablist" aria-label="Choose a cafeteria workflow">
      {tabs.map((tab) => <button key={tab.id} type="button" role="tab" id={`cafeteria-tab-${tab.id}`} aria-selected={activeTab === tab.id} aria-controls="cafeteria-action-panel" className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
    </div>
    <div className="cafeteria-action-panel" id="cafeteria-action-panel" role="tabpanel" aria-labelledby={`cafeteria-tab-${active.id}`} key={active.id}>
      <div className="cafeteria-action-panel__heading"><div><h3>{active.label}</h3><p>{active.description}</p></div><span>{tabs.findIndex((tab) => tab.id === active.id) + 1} / {tabs.length}</span></div>
      {renderForm()}
    </div>
  </section>;
}
