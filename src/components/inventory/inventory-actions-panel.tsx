"use client";

import { useState } from "react";

import { CategoryForm, ItemForm, StockTransactionForm, SupplierForm, UnitForm } from "@/components/inventory/inventory-forms";

type Option = { id: string; name: string };
type InventoryItemOption = Option & { currentQuantity: number; unit: string };
type TabId = "item" | "movement" | "category" | "unit" | "supplier";

export function InventoryActionsPanel({
  categories,
  units,
  suppliers,
  items,
}: {
  categories: Option[];
  units: Option[];
  suppliers: Option[];
  items: InventoryItemOption[];
}) {
  const tabs: Array<{ id: TabId; label: string; description: string }> = [
    { id: "item", label: "Add item", description: "Create a trackable stock item with a SKU, reorder threshold, and storage location." },
    { id: "movement", label: "Record movement", description: "Receive, issue, return, or adjust stock and preview the resulting on-hand quantity." },
    { id: "category", label: "Add category", description: "Organize inventory into useful groups." },
    { id: "unit", label: "Add unit", description: "Define the units used to count and issue stock." },
    { id: "supplier", label: "Add supplier", description: "Keep supplier contact details alongside the inventory register." },
  ];
  const [activeTab, setActiveTab] = useState<TabId>("item");
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  function renderForm() {
    switch (activeTab) {
      case "item":
        return <ItemForm categories={categories} units={units} suppliers={suppliers} />;
      case "movement":
        return <StockTransactionForm items={items} />;
      case "category":
        return <CategoryForm />;
      case "unit":
        return <UnitForm />;
      case "supplier":
        return <SupplierForm />;
    }
  }

  return <section className="inventory-actions" id="inventory-actions" aria-label="Inventory actions">
    <div className="inventory-action-tabs" role="tablist" aria-label="Choose an inventory action">
      {tabs.map((tab) => <button key={tab.id} id={`inventory-action-tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls="inventory-action-panel" className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
    </div>
    <div className="inventory-action-panel" id="inventory-action-panel" role="tabpanel" aria-labelledby={`inventory-action-tab-${active.id}`} key={active.id}>
      <div className="inventory-action-panel__heading"><div><h2>{active.label}</h2><p>{active.description}</p></div><span>{tabs.findIndex((tab) => tab.id === active.id) + 1} / {tabs.length}</span></div>
      {renderForm()}
    </div>
  </section>;
}
