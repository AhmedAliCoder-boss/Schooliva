import Link from "next/link";
import { redirect } from "next/navigation";

import { InventoryActionsPanel } from "@/components/inventory/inventory-actions-panel";
import { InventoryRegister, type InventoryItemRow, type InventoryTransactionRow } from "@/components/inventory/inventory-register";
import { ProgressWheel } from "@/components/progress-wheel";
import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { createClient } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;
type Named = { name: string | null; short_name?: string | null };

function relation<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeZone: "Asia/Karachi" }).format(date);
}

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { schoolId, isMasterAdmin } = await getActiveSchoolContext(supabase, user.id);
  if (!schoolId) redirect(isMasterAdmin ? "/admin" : "/setup?onboarding=1");

  const [
    { data: canView, error: viewPermissionError },
    { data: canManage, error: managePermissionError },
    { data: canViewReports, error: reportsPermissionError },
  ] = await Promise.all([
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "inventory", target_action: "view" }),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "inventory", target_action: "manage" }),
    supabase.rpc("has_permission", { target_school_id: schoolId, target_resource: "reports", target_action: "view" }),
  ]);
  if (viewPermissionError || managePermissionError || reportsPermissionError) {
    console.error("Inventory permissions could not be checked.", { viewPermissionError, managePermissionError, reportsPermissionError });
    throw new Error("Inventory permissions could not be verified.");
  }
  if (!canView && !canManage && !canViewReports) redirect("/dashboard?error=not-authorized");

  const [
    { data: schoolSettings, error: schoolSettingsError },
    { data: categories, error: categoriesError },
    { data: units, error: unitsError },
    { data: suppliers, error: suppliersError },
    { data: itemRecords, error: itemsError },
    { data: transactionRecords, error: transactionsError },
  ] = await Promise.all([
    supabase.from("school_settings").select("currency_code,locale").eq("school_id", schoolId).maybeSingle(),
    supabase.from("inventory_categories").select("id,name").eq("school_id", schoolId).order("name").limit(1000),
    supabase.from("inventory_units").select("id,name,short_name").eq("school_id", schoolId).order("name").limit(500),
    supabase.from("inventory_suppliers").select("id,name").eq("school_id", schoolId).order("name").limit(1000),
    supabase.from("inventory_items")
      .select("id,name,sku,current_quantity,min_stock_level,cost,location,status,category_id,unit_id,supplier_id,inventory_categories(name),inventory_units(name,short_name),inventory_suppliers(name)")
      .eq("school_id", schoolId).order("name").limit(5000),
    supabase.from("inventory_transactions")
      .select("id,transaction_type,quantity,unit_cost,created_at,reference,purchase_department,purchase_order_number,bill_storage_path,bill_file_name,notes,item_id,created_by")
      .eq("school_id", schoolId).order("created_at", { ascending: false }).limit(5000),
  ]);
  if (schoolSettingsError || categoriesError || unitsError || suppliersError || itemsError || transactionsError) {
    console.error("Inventory data could not be loaded.", { schoolSettingsError, categoriesError, unitsError, suppliersError, itemsError, transactionsError });
    throw new Error("Inventory workspace data could not be loaded.");
  }
  if (!schoolSettings) {
    console.error("Inventory currency settings are not configured for this school.", { schoolId });
    throw new Error("School currency settings must be configured before inventory values can be displayed.");
  }

  const currency = schoolSettings.currency_code.trim();
  const locale = schoolSettings.locale.trim();
  const currencyFormatter = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 });
  const roundedCurrencyFormatter = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 });
  const formatCurrency = (value: number) => currencyFormatter.format(value);
  const formatRoundedCurrency = (value: number) => roundedCurrencyFormatter.format(value);
  const categoryOptions = (categories ?? []).map((item) => ({ id: String(item.id), name: String(item.name) }));
  const unitOptions = (units ?? []).map((item) => ({ id: String(item.id), name: `${String(item.name)} (${String(item.short_name)})` }));
  const supplierOptions = (suppliers ?? []).map((item) => ({ id: String(item.id), name: String(item.name) }));
  const items: InventoryItemRow[] = (itemRecords ?? []).map((item) => ({
    id: String(item.id),
    name: String(item.name),
    sku: String(item.sku),
    category: relation<Named>(item.inventory_categories)?.name ?? "Uncategorised",
    unit: relation<Named>(item.inventory_units)?.short_name ?? relation<Named>(item.inventory_units)?.name ?? "units",
    supplier: relation<Named>(item.inventory_suppliers)?.name ?? "",
    location: String(item.location ?? ""),
    cost: Number(item.cost),
    formattedCost: formatCurrency(Number(item.cost)),
    formattedValue: formatCurrency(Number(item.cost) * Number(item.current_quantity)),
    quantity: Number(item.current_quantity),
    minStockLevel: Number(item.min_stock_level),
    status: String(item.status),
  }));
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const transactionsWithBills = (transactionRecords ?? []).filter((transaction) => transaction.bill_storage_path);
  const billUrlsByPath = new Map<string, string>();
  if (transactionsWithBills.length) {
    const { data: signedBills, error: signedBillsError } = await supabase.storage
      .from("inventory-purchase-bills")
      .createSignedUrls(transactionsWithBills.map((transaction) => String(transaction.bill_storage_path)), 600);
    if (signedBillsError || !signedBills) {
      console.error("Inventory payment bills could not be signed for viewing.", signedBillsError);
      throw new Error("Inventory payment bills could not be loaded.");
    }
    for (const bill of signedBills) {
      if (bill.error || !bill.path || !bill.signedUrl) {
        console.error("An inventory payment bill could not be signed.", { path: bill.path, error: bill.error });
        throw new Error("An inventory payment bill could not be loaded.");
      }
      billUrlsByPath.set(bill.path, bill.signedUrl);
    }
    if (transactionsWithBills.some((transaction) => !billUrlsByPath.has(String(transaction.bill_storage_path)))) {
      console.error("Not all inventory payment bills received a signed URL.");
      throw new Error("An inventory payment bill could not be loaded.");
    }
  }
  const transactions: InventoryTransactionRow[] = (transactionRecords ?? []).map((transaction) => ({
    id: String(transaction.id),
    itemId: String(transaction.item_id),
    itemName: itemsById.get(String(transaction.item_id))?.name ?? "Unknown item",
    sku: itemsById.get(String(transaction.item_id))?.sku ?? "",
    unit: itemsById.get(String(transaction.item_id))?.unit ?? "units",
    type: String(transaction.transaction_type),
    quantity: Number(transaction.quantity),
    formattedUnitCost: transaction.unit_cost === null ? null : formatCurrency(Number(transaction.unit_cost)),
    reference: String(transaction.reference ?? ""),
    purchaseDepartment: String(transaction.purchase_department ?? ""),
    purchaseOrderNumber: String(transaction.purchase_order_number ?? ""),
    paymentBillName: String(transaction.bill_file_name ?? ""),
    paymentBillUrl: transaction.bill_storage_path ? billUrlsByPath.get(String(transaction.bill_storage_path)) ?? null : null,
    notes: String(transaction.notes ?? ""),
    createdAt: displayDate(String(transaction.created_at)),
    createdBy: transaction.created_by ? `Staff · ${String(transaction.created_by).slice(0, 8)}` : "Staff",
  }));
  const activeItems = items.filter((item) => item.status === "active");
  const lowStockItems = activeItems.filter((item) => item.quantity <= item.minStockLevel);
  const totalQuantity = activeItems.reduce((sum, item) => sum + item.quantity, 0);
  const inventoryValue = activeItems.reduce((sum, item) => sum + item.quantity * item.cost, 0);
  const zeroStockCount = activeItems.filter((item) => item.quantity === 0).length;
  const lowStockPercent = activeItems.length ? Math.round(lowStockItems.length / activeItems.length * 100) : 0;
  const itemOptions = activeItems.map((item) => ({ id: item.id, name: item.name, currentQuantity: item.quantity, unit: item.unit }));

  return <main className="students-shell inventory-shell">
    <header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/dashboard">Dashboard -&gt;</Link></header>
    <section className="module-page-header inventory-page-header"><div className="module-page-header__row"><div>
      <p className="module-page-header__eyebrow">Operations / Inventory</p>
      <h1>Know what you have. Stay ready.</h1>
      <p>Manage stock, vendors, reorder thresholds, and a traceable movement ledger from one workspace.</p>
    </div><a className="inventory-page-header__action" href="#inventory-actions">+ Manage inventory</a></div></section>

    <section className="module-kpi-grid inventory-kpi-grid" aria-label="Inventory summary">
      <article className="module-kpi inventory-kpi"><span>Active items</span><strong>{activeItems.length}</strong><small>{items.length - activeItems.length} inactive</small></article>
      <article className="module-kpi inventory-kpi"><span>Units on hand</span><strong>{totalQuantity.toLocaleString()}</strong><small>Across active catalog items</small></article>
      <ProgressWheel label="At reorder level" value={lowStockItems.length} percentage={lowStockPercent} color="#be123c" detail={`${lowStockItems.length} of ${activeItems.length} active items`} />
      <article className={`module-kpi inventory-kpi${zeroStockCount ? " inventory-kpi--alert" : ""}`}><span>Out of stock</span><strong>{zeroStockCount}</strong><small>Active items with zero quantity</small></article>
      <article className="module-kpi inventory-kpi"><span>Stock value</span><strong>{formatRoundedCurrency(inventoryValue)}</strong><small>Estimated at current unit cost</small></article>
    </section>

    {canManage && <InventoryActionsPanel
      categories={categoryOptions}
      units={unitOptions}
      suppliers={supplierOptions}
      items={itemOptions}
    />}
    <InventoryRegister
      items={items}
      transactions={transactions}
      formattedInventoryValue={formatCurrency(inventoryValue)}
    />
  </main>;
}
