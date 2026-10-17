import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintAction } from "@/components/print/print-action";
import { requireMasterAdmin } from "@/lib/admin/guard";
import { formatCurrency } from "@/lib/format/currency";

type Params = Promise<{ contractId: string }>;

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-PK", { dateStyle: "long", timeZone: "UTC" }).format(date);
}

export default async function PlatformContractPrintPage({ params }: { params: Params }) {
  const { contractId } = await params;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(contractId)) notFound();

  const { supabase } = await requireMasterAdmin();
  const { data: contract, error: contractError } = await supabase.from("platform_contracts")
    .select("id,school_id,contract_number,plan_name,pricing_model,monthly_amount,status,start_date,end_date,subscription_valid_until,renewal_date")
    .eq("id", contractId)
    .maybeSingle();
  if (contractError) throw new Error("Platform contract could not be loaded for printing.");
  if (!contract) notFound();

  const [{ data: school, error: schoolError }, { data: bills, error: billsError }] = await Promise.all([
    supabase.from("schools")
      .select("name,code,email,phone,address,city,state,country")
      .eq("id", contract.school_id)
      .maybeSingle(),
    supabase.from("platform_bills")
      .select("id,bill_number,description,total_amount,paid_amount,due_date,status,billing_period_start,billing_period_end")
      .eq("contract_id", contract.id)
      .order("billing_period_start", { ascending: true }),
  ]);
  if (schoolError || billsError) throw new Error("Contract parties or billing schedule could not be loaded.");
  if (!school) notFound();

  const monthlyAmount = Number(contract.monthly_amount ?? 0);
  const billedAmount = monthlyAmount * (contract.pricing_model === "annual" ? 12 : 1);
  const address = [school.address, school.city, school.state, school.country].filter(Boolean).join(", ");

  return <main className="school-document-page platform-bill-print-page">
    <div className="school-document-toolbar no-print">
      <Link href="/admin/contracts">← Back to contracts</Link>
      <PrintAction label="Print agreement / Save PDF" />
    </div>
    <article className="platform-contract-document">
      <header className="platform-contract-document__header">
        <div><Image src="/brand/landscape_logo.png" alt="Schooliva" width={190} height={56} priority /><span>School management, clearly managed.</span></div>
        <div><span>SCHOOLIVA PLATFORM</span><h1>SUBSCRIPTION AGREEMENT</h1><strong>{contract.contract_number}</strong></div>
      </header>

      <section className="platform-contract-document__parties">
        <div><span>SERVICE PROVIDER</span><h2>Schooliva Platform</h2><p>Platform subscription and school management services</p></div>
        <div><span>SCHOOL / CUSTOMER</span><h2>{school.name}</h2><p>School code: {school.code}</p>{address && <p>{address}</p>}{(school.email || school.phone) && <p>{[school.email, school.phone].filter(Boolean).join(" · ")}</p>}</div>
      </section>

      <section className="platform-contract-document__terms">
        <h2>Subscription terms</h2>
        <dl>
          <div><dt>Plan</dt><dd>{contract.plan_name}</dd></div>
          <div><dt>Billing cycle</dt><dd>{contract.pricing_model}</dd></div>
          <div><dt>Monthly equivalent</dt><dd>{formatCurrency(monthlyAmount)}</dd></div>
          <div><dt>Invoice amount</dt><dd>{formatCurrency(billedAmount)}{contract.pricing_model === "annual" ? " per year" : " per billing period"}</dd></div>
          <div><dt>Term starts</dt><dd>{formatDate(contract.start_date)}</dd></div>
          <div><dt>Agreement ends</dt><dd>{formatDate(contract.end_date)}</dd></div>
          <div><dt>Subscription paid through</dt><dd>{formatDate(contract.subscription_valid_until ?? (contract.status === "active" ? contract.renewal_date : null))}</dd></div>
          <div><dt>Renewal date</dt><dd>{formatDate(contract.renewal_date)}</dd></div>
          <div><dt>Agreement status</dt><dd className="is-status">{contract.status.replaceAll("_", " ")}</dd></div>
        </dl>
        <p>For monthly or annual terms, renewal invoices are scheduled from the Contracts workspace according to this billing cycle. The subscription is activated or extended only after the complete linked invoice is recorded as paid. Access continues through the paid term; an unpaid renewal does not extend access beyond its term end date. Custom agreements are billed manually according to their separately agreed terms.</p>
      </section>

      <section className="platform-contract-document__billing">
        <h2>Invoice schedule and payment record</h2>
        {(bills ?? []).length ? <table>
          <thead><tr><th>Invoice / period</th><th>Due date</th><th>Status</th><th className="is-amount">Total</th><th className="is-amount">Paid</th></tr></thead>
          <tbody>{(bills ?? []).map((bill) => <tr key={bill.id}>
            <td><strong>{bill.bill_number}</strong><small>{formatDate(bill.billing_period_start)} – {formatDate(bill.billing_period_end)}</small></td>
            <td>{formatDate(bill.due_date)}</td>
            <td>{bill.status.replaceAll("_", " ")}</td>
            <td className="is-amount">{formatCurrency(Number(bill.total_amount ?? 0))}</td>
            <td className="is-amount">{formatCurrency(Number(bill.paid_amount ?? 0))}</td>
          </tr>)}</tbody>
        </table> : <p>The first invoice has not been scheduled yet.</p>}
      </section>

      <section className="platform-contract-document__acceptance">
        <p>By signing below, the parties acknowledge the subscription plan, billing cycle, and payment terms stated in this agreement. This document records the platform agreement details; any additional negotiated terms should be attached and signed by both parties.</p>
        <div><span>For Schooliva Platform</span><span>For {school.name}</span></div>
        <div className="platform-contract-document__signature-lines"><i /><i /></div>
        <div><span>Name / title / date</span><span>Name / title / date</span></div>
      </section>

      <footer className="platform-contract-document__footer"><strong>Schooliva Platform</strong><span>Agreement reference: {contract.contract_number}</span></footer>
    </article>
  </main>;
}
