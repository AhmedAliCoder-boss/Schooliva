import Link from "next/link";
import { PrintAction } from "@/components/print/print-action";
import { SchoolDocument } from "@/components/print/school-document";
import { requireFinanceContext } from "@/lib/finance/context";
import { formatCurrency } from "@/lib/format/currency";
import { getSchoolDocumentIdentity } from "@/lib/print/school-document";

export default async function FeeStructuresPrintPage() {
  const { supabase, schoolId } = await requireFinanceContext("view");
  const [{ data: schoolClasses, error: classError }, { data: sessions, error: sessionError }, { data: fees, error: feesError }] = await Promise.all([
    supabase.from("classes").select("id,name").eq("school_id", schoolId),
    supabase.from("academic_sessions").select("id,name").eq("school_id", schoolId),
    supabase.from("fee_structures").select("academic_session_id,class_id,fee_type,amount,frequency,due_day,is_optional,is_active").eq("school_id", schoolId).order("fee_type"),
  ]);
  if (classError || sessionError || feesError) throw new Error("Fee schedule could not be loaded.");
  const school = await getSchoolDocumentIdentity(supabase, schoolId);
  const classNames = new Map((schoolClasses ?? []).map((row) => [String(row.id), String(row.name)]));
  const sessionNames = new Map((sessions ?? []).map((row) => [String(row.id), String(row.name)]));

  return <main className="school-document-page"><div className="school-document-toolbar no-print"><Link href="/finance/fees">Back to fee structures</Link><PrintAction label="Print fee schedule / Save PDF" /></div>
    <SchoolDocument school={school} title="Fee schedule">
      <table className="school-document__table"><thead><tr><th>Fee item</th><th>Class</th><th>Academic session</th><th>Frequency</th><th>Due day</th><th>Amount</th><th>Status</th></tr></thead><tbody>
        {(fees ?? []).map((fee, index) => <tr key={`${fee.class_id}-${fee.academic_session_id}-${fee.fee_type}-${index}`}><td>{String(fee.fee_type).replaceAll("_", " ")}{fee.is_optional ? " (optional)" : ""}</td><td>{classNames.get(String(fee.class_id)) ?? "Class"}</td><td>{sessionNames.get(String(fee.academic_session_id)) ?? "Session"}</td><td>{String(fee.frequency).replaceAll("_", " ")}</td><td>{fee.due_day}</td><td>{formatCurrency(fee.amount)}</td><td>{fee.is_active ? "Active" : "Inactive"}</td></tr>)}
      </tbody></table>
      {!fees?.length && <p>No fee structures are configured.</p>}
    </SchoolDocument>
  </main>;
}
