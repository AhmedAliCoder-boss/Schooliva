import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CategoryForm, ItemForm, StockTransactionForm, SupplierForm, UnitForm } from "@/components/inventory/inventory-forms";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { data: membership } = await supabase.from("user_roles").select("school_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership?.school_id) redirect("/setup?onboarding=1");
  const schoolId = membership.school_id as string;

  const [{ data: categories }, { data: units }, { data: suppliers }, { data: items }, { data: transactions }] = await Promise.all([
    supabase.from("inventory_categories").select("id,name").eq("school_id", schoolId).order("name"),
    supabase.from("inventory_units").select("id,name,short_name").eq("school_id", schoolId).order("name"),
    supabase.from("inventory_suppliers").select("id,name").eq("school_id", schoolId).order("name"),
    supabase.from("inventory_items").select("id,name,sku,current_quantity,min_stock_level,cost,location,inventory_categories(name),inventory_units(name)").eq("school_id", schoolId).order("name"),
    supabase.from("inventory_transactions").select("id,transaction_type,quantity,unit_cost,created_at,reference,notes,item_id").eq("school_id", schoolId).order("created_at", { ascending: false }),
  ]);

  const categoryOptions = (categories ?? []).map((item) => ({ id: String(item.id), name: String(item.name) }));
  const unitOptions = (units ?? []).map((item) => ({ id: String(item.id), name: `${String(item.name)} (${String(item.short_name)})` }));
  const supplierOptions = (suppliers ?? []).map((item) => ({ id: String(item.id), name: String(item.name) }));
  const itemOptions = (items ?? []).map((item) => ({ id: String(item.id), name: `${String(item.name)} · ${String(item.current_quantity)} in stock` }));

  return <main className="students-shell">
    <header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/dashboard">Dashboard -&gt;</Link></header>
    <section className="students-heading"><div><p className="eyebrow">Inventory</p><h1>Stock, suppliers, and adjustments.</h1><p>Track every movement, keep accurate quantities, and surface low-stock alerts before operational disruption.</p></div></section>
    <section className="setup-card"><h3>Catalog setup</h3><CategoryForm /><UnitForm /><SupplierForm /><ItemForm categories={categoryOptions} units={unitOptions} suppliers={supplierOptions} /></section>
    <section className="setup-card"><h3>Stock movement</h3><StockTransactionForm items={itemOptions} /></section>
    <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Item</th><th>SKU</th><th>Location</th><th>Stock</th><th>Min</th><th>Status</th></tr></thead><tbody>{(items ?? []).length ? (items ?? []).map((item) => { const low = Number(item.current_quantity) <= Number(item.min_stock_level); return <tr key={String(item.id)}><td>{String(item.name)}</td><td>{String(item.sku)}</td><td>{String(item.location ?? "-")}</td><td>{String(item.current_quantity)}</td><td>{String(item.min_stock_level)}</td><td><span className={`status-pill ${low ? "draft" : "active"}`}>{low ? "Low stock" : "Healthy"}</span></td></tr>; }) : <tr><td colSpan={6}><div className="student-empty"><h3>No inventory items</h3><p>Add stock items to generate low-stock monitoring.</p></div></td></tr>}</tbody></table></div>
    <div className="student-table-wrap" style={{ marginTop: 24 }}><table className="student-table"><thead><tr><th>Item</th><th>Type</th><th>Qty</th><th>Cost</th><th>Reference</th><th>Date</th></tr></thead><tbody>{(transactions ?? []).length ? (transactions ?? []).map((transaction) => <tr key={String(transaction.id)}><td>{String(transaction.item_id)}</td><td>{String(transaction.transaction_type)}</td><td>{String(transaction.quantity)}</td><td>{String(transaction.unit_cost ?? "-")}</td><td>{String(transaction.reference ?? "-")}</td><td>{new Date(String(transaction.created_at)).toLocaleDateString()}</td></tr>) : <tr><td colSpan={6}><div className="student-empty"><h3>No stock history</h3><p>All stock in/out and adjustments will appear here.</p></div></td></tr>}</tbody></table></div>
  </main>;
}
