import Link from "next/link";

import { FeeStructureForm } from "@/components/finance/finance-forms";
import { FinanceFormDisclosure } from "@/components/finance/finance-form-disclosure";
import { FeeStructureActions } from "@/components/finance/fee-structure-actions";
import { canManageFinance, requireFinanceContext } from "@/lib/finance/context";
import { formatCurrency } from "@/lib/format/currency";

export default async function FinanceFeesPage() {
  const { supabase, schoolId } = await requireFinanceContext("view");
  const [{ data: structures, error: structuresError }, { data: classes, error: classesError }, { data: sessions, error: sessionsError }, canManage] = await Promise.all([
    supabase.from("fee_structures").select("id,academic_session_id,class_id,fee_type,amount,frequency,due_day,is_optional,is_active").eq("school_id", schoolId).order("fee_type"),
    supabase.from("classes").select("id,name").eq("school_id", schoolId).order("name"),
    supabase.from("academic_sessions").select("id,name").eq("school_id", schoolId).order("starts_on", { ascending: false }),
    canManageFinance(supabase, schoolId),
  ]);
  if (structuresError || classesError || sessionsError) throw new Error("Fee structure data could not be loaded.");
  const classNames = new Map((classes ?? []).map((item) => [String(item.id), String(item.name)]));
  const sessionNames = new Map((sessions ?? []).map((item) => [String(item.id), String(item.name)]));

  return <main className="students-shell finance-shell">
    <section className="module-page-header"><div className="module-page-header__row"><div>
      <p className="module-page-header__eyebrow">Finance / Fees</p><h1>Fee structures</h1>
      <p>Set class and session based fees. New structures are available immediately when you create invoices.</p>
    </div></div></section>
    <section className="finance-work-grid">
      {canManage && <FinanceFormDisclosure label="Add fee" title="New fee structure" description="Define the amount and collection schedule.">
        <FeeStructureForm sessions={(sessions ?? []).map((row) => ({ id: String(row.id), name: String(row.name) }))} classes={(classes ?? []).map((row) => ({ id: String(row.id), name: String(row.name) }))} />
      </FinanceFormDisclosure>}
      <section className="finance-work-card finance-work-card--records" aria-labelledby="fee-structure-list-title">
        <header className="finance-work-card__heading"><div><span className="dashboard-panel-kicker">Fee register</span><h2 id="fee-structure-list-title">Current fee structures</h2><p>{structures?.length ?? 0} configured fee items</p></div><Link className="school-document-link no-print" href="/finance/print/fee-structures">Print fee schedule / PDF</Link></header>
        {(structures ?? []).length ? <div className="finance-structure-list">{structures?.map((item) => <article className={`finance-structure-row ${item.is_active ? "" : "is-inactive"}`} key={String(item.id)}>
          <div><strong>{String(item.fee_type).replaceAll("_", " ")}</strong><span>{classNames.get(String(item.class_id)) ?? "Class unavailable"} · {sessionNames.get(String(item.academic_session_id)) ?? "Session unavailable"}</span></div>
          <div className="finance-structure-row__amount"><strong>{formatCurrency(item.amount)}</strong><span>{String(item.frequency).replaceAll("_", " ")} · due day {item.due_day}</span></div>
          <span className={`finance-state-pill ${item.is_active ? "is-active" : "is-inactive"}`}>{item.is_active ? "Active" : "Inactive"}</span>
          {canManage && <FeeStructureActions feeStructureId={String(item.id)} isActive={Boolean(item.is_active)} />}
        </article>)}</div> : <div className="student-empty"><h3>No fee structures yet</h3><p>{canManage ? "Add your first fee structure to make it available for invoices." : "Fee structures will appear here when added."}</p></div>}
      </section>
    </section>
  </main>;
}
