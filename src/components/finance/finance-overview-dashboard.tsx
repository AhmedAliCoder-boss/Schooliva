"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { formatCurrency } from "@/lib/format/currency";

type InvoiceSummary = {
  total: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  dueDate: string;
  createdAt: string;
};

type Collection = {
  id: string;
  reference: string;
  invoiceId: string;
  amount: number;
  method: string;
  date: string;
};

type Expense = { amount: number; date: string };
type PeriodDays = 7 | 30 | 90 | 365;

const periods: { days: PeriodDays; label: string }[] = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
];

const financeSections = [
  { href: "/finance/fees", number: "01", title: "Fee structures", description: "Configure class fees and collection schedules.", action: "Manage fees" },
  { href: "/finance/invoices", number: "02", title: "Invoices", description: "Create bills and follow outstanding balances.", action: "Open invoices" },
  { href: "/finance/payments", number: "03", title: "Payments", description: "Record collections and issue receipts.", action: "Record payment" },
  { href: "/finance/expenses", number: "04", title: "Expenses", description: "Track operating costs and school spending.", action: "Manage expenses" },
];

function dayString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateOffset(asOfDate: string, days: number) {
  const date = new Date(`${asOfDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return dayString(date);
}

function sumAmount<T extends { amount: number; date: string }>(rows: T[], from: string, to: string) {
  return rows.reduce((sum, row) => row.date >= from && row.date <= to ? sum + row.amount : sum, 0);
}

function trendLabel(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en", { month: "short", timeZone: "UTC" });
}

function StatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "amber" | "green" | "violet";
}) {
  return <article className={`finance-overview-stat finance-overview-stat--${tone}`}>
    <div className="finance-overview-stat__top"><span>{label}</span><i aria-hidden="true" /></div>
    <strong>{value}</strong>
    <small>{detail}</small>
  </article>;
}

export function FinanceOverviewDashboard({
  asOfDate,
  invoices,
  collections,
  expenses,
  activeFeeCount,
  canViewExpenses,
}: {
  asOfDate: string;
  invoices: InvoiceSummary[];
  collections: Collection[];
  expenses: Expense[];
  activeFeeCount: number;
  canViewExpenses: boolean;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [period, setPeriod] = useState<PeriodDays>(30);
  const selectedPeriod = periods.find((item) => item.days === period) ?? periods[1];
  const currentStart = dateOffset(asOfDate, period - 1);
  const previousEnd = dateOffset(asOfDate, period);
  const previousStart = dateOffset(asOfDate, period * 2 - 1);

  const summary = useMemo(() => {
    const collected = sumAmount(collections, currentStart, asOfDate);
    const previousCollected = sumAmount(collections, previousStart, previousEnd);
    const expensesInPeriod = sumAmount(expenses, currentStart, asOfDate);
    const previousExpenses = sumAmount(expenses, previousStart, previousEnd);
    const issuedInvoices = invoices.filter((invoice) => invoice.createdAt.slice(0, 10) >= currentStart && invoice.createdAt.slice(0, 10) <= asOfDate);
    const overdueInvoices = invoices.filter((invoice) =>
      invoice.remainingAmount > 0 && invoice.status !== "cancelled" && invoice.dueDate < asOfDate,
    );
    const outstanding = invoices.reduce((sum, invoice) =>
      invoice.status === "cancelled" ? sum : sum + invoice.remainingAmount, 0,
    );

    return {
      collected,
      collectedAllTime: invoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0),
      previousCollected,
      expensesInPeriod,
      previousExpenses,
      issuedCount: issuedInvoices.length,
      outstanding,
      overdueAmount: overdueInvoices.reduce((sum, invoice) => sum + invoice.remainingAmount, 0),
      overdueCount: overdueInvoices.length,
      openInvoiceCount: invoices.filter((invoice) => invoice.remainingAmount > 0 && invoice.status !== "cancelled").length,
    };
  }, [asOfDate, collections, currentStart, expenses, invoices, previousEnd, previousStart]);

  const monthlyFlow = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(`${asOfDate}T00:00:00.000Z`);
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() - (5 - index));
      const start = dayString(date);
      const nextMonth = new Date(date);
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
      const end = dayString(new Date(nextMonth.getTime() - 24 * 60 * 60 * 1000));
      return {
        key: start.slice(0, 7),
        label: trendLabel(start),
        collected: sumAmount(collections, start, end),
        expenses: sumAmount(expenses, start, end),
      };
    });
    const max = Math.max(1, ...months.flatMap((month) => [month.collected, canViewExpenses ? month.expenses : 0]));
    return { months, max };
  }, [asOfDate, canViewExpenses, collections, expenses]);

  const recentCollections = collections.slice(0, 6);
  const collectionChange = summary.collected - summary.previousCollected;
  const collectionChangePercent = summary.previousCollected > 0
    ? Math.round((collectionChange / summary.previousCollected) * 100)
    : null;

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, 60_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [router]);

  function refreshNow() {
    startRefresh(() => router.refresh());
  }

  return <>
    <header className="finance-overview-hero">
      <div className="finance-overview-hero__copy">
        <span className="finance-overview-eyebrow"><i /> Finance command center</span>
        <h1>Good decisions start with a clear view.</h1>
        <p>Track live collections, current balances, invoices, and school spending at a glance.</p>
      </div>
      <div className="finance-overview-hero__actions">
        <Link href="/finance/invoices" className="finance-overview-primary-action"><span aria-hidden="true">＋</span> Create invoice</Link>
        <Link href="/finance/payments" className="finance-overview-secondary-action">Record payment <span aria-hidden="true">→</span></Link>
      </div>
      <div className="finance-overview-hero__glow" aria-hidden="true" />
    </header>

    <section className="finance-overview-period" aria-label="Finance summary period">
      <div className="finance-overview-period__copy">
        <span className="finance-overview-live"><i /> Live snapshot</span>
        <span>Period activity compares with the previous matching period; outstanding is the current balance.</span>
      </div>
      <div className="finance-overview-period__options" role="group" aria-label="Choose summary period">
        {periods.map((option) => <button
          key={option.days}
          type="button"
          className={period === option.days ? "is-active" : ""}
          aria-pressed={period === option.days}
          onClick={() => setPeriod(option.days)}
        >{option.label}</button>)}
      </div>
      <button type="button" className="finance-overview-refresh" onClick={refreshNow} disabled={isRefreshing}>
        <span aria-hidden="true" className={isRefreshing ? "is-spinning" : ""}>↻</span>
        {isRefreshing ? "Refreshing…" : "Refresh"}
      </button>
    </section>

    <section className={`finance-overview-stats ${canViewExpenses ? "" : "finance-overview-stats--limited"}`} aria-label={`${selectedPeriod.label} finance statistics`}>
      <StatCard
        label="Collected · all time"
        value={formatCurrency(summary.collectedAllTime)}
        detail={collectionChangePercent === null
          ? `${formatCurrency(summary.collected)} in ${selectedPeriod.label} · no previous collections`
          : `${formatCurrency(summary.collected)} in ${selectedPeriod.label} · ${collectionChange >= 0 ? "↑" : "↓"} ${Math.abs(collectionChangePercent)}% vs previous`}
        tone="blue"
      />
      <StatCard
        label="Outstanding · current"
        value={formatCurrency(summary.outstanding)}
        detail={`${summary.openInvoiceCount} open · ${summary.overdueCount} overdue (${formatCurrency(summary.overdueAmount)})`}
        tone="amber"
      />
      <StatCard
        label={`Invoices · ${selectedPeriod.label}`}
        value={String(summary.issuedCount)}
        detail={`${activeFeeCount} active fee structures available`}
        tone="violet"
      />
      {canViewExpenses && <StatCard
        label={`Expenses · ${selectedPeriod.label}`}
        value={formatCurrency(summary.expensesInPeriod)}
        detail={summary.previousExpenses > 0
          ? `${summary.expensesInPeriod <= summary.previousExpenses ? "↓" : "↑"} ${Math.round(Math.abs((summary.expensesInPeriod - summary.previousExpenses) / summary.previousExpenses) * 100)}% vs previous`
          : summary.expensesInPeriod > 0 ? "No expenses in previous period" : "No expenses recorded in this period"}
        tone="green"
      />}
    </section>

    <section className="finance-overview-main-grid">
      <article className="finance-overview-panel finance-overview-flow">
        <header className="finance-overview-panel__heading">
          <div><span className="finance-overview-kicker">Cash flow</span><h2>Collections &amp; spending</h2><p>Monthly activity · last 6 months</p></div>
          <Link href="/reports">View reports <span aria-hidden="true">→</span></Link>
        </header>
        <div className="finance-overview-chart-legend">
          <span><i className="is-collection" /> Collections</span>
          {canViewExpenses && <span><i className="is-expense" /> Expenses</span>}
        </div>
        <div className="finance-overview-chart" role="img" aria-label={`Monthly collections and ${canViewExpenses ? "expenses" : "cash flow"} for the last six months`}>
          <div className="finance-overview-chart__axis"><span>{formatCurrency(financeOverviewAxisValue(monthlyFlow.max))}</span><span>{formatCurrency(financeOverviewAxisValue(monthlyFlow.max) / 2)}</span><span>0</span></div>
          <div className="finance-overview-chart__months">
            {monthlyFlow.months.map((month) => <div className="finance-overview-chart__month" key={month.key} title={`${month.label}: collections ${formatCurrency(month.collected)}${canViewExpenses ? `, expenses ${formatCurrency(month.expenses)}` : ""}`}>
              <div className="finance-overview-chart__bars">
                <i className="is-collection" style={{ height: `${Math.max(3, (month.collected / monthlyFlow.max) * 100)}%` }} />
                {canViewExpenses && <i className="is-expense" style={{ height: `${Math.max(3, (month.expenses / monthlyFlow.max) * 100)}%` }} />}
              </div>
              <span>{month.label}</span>
            </div>)}
          </div>
        </div>
      </article>

      <aside className="finance-overview-panel finance-overview-health">
        <header className="finance-overview-panel__heading">
          <div><span className="finance-overview-kicker">Attention</span><h2>Receivables health</h2><p>Balances that may need follow-up</p></div>
        </header>
        <div className="finance-overview-health__balance"><span>Total overdue</span><strong>{formatCurrency(summary.overdueAmount)}</strong></div>
        <div className="finance-overview-health__meter" aria-label={`${summary.overdueCount} overdue invoices`}><i style={{ width: `${summary.openInvoiceCount ? Math.min(100, (summary.overdueCount / summary.openInvoiceCount) * 100) : 0}%` }} /></div>
        <div className="finance-overview-health__meta"><span>{summary.overdueCount} overdue</span><span>{summary.openInvoiceCount} open total</span></div>
        <Link className="finance-overview-health__action" href="/finance/invoices?status=overdue">Review overdue invoices <span aria-hidden="true">→</span></Link>
      </aside>
    </section>

    <section className="finance-overview-lower-grid">
      <article className="finance-overview-panel finance-overview-recent">
        <header className="finance-overview-panel__heading">
          <div><span className="finance-overview-kicker">Latest activity</span><h2>Recent collections</h2><p>Most recent recorded payments</p></div>
          <Link href="/finance/payments">All payments <span aria-hidden="true">→</span></Link>
        </header>
        {recentCollections.length ? <ul className="finance-overview-payment-list">
          {recentCollections.map((payment) => <li key={payment.id}>
            <span className="finance-overview-payment-list__icon" aria-hidden="true">↙</span>
            <span className="finance-overview-payment-list__main"><strong>{payment.reference}</strong><small>{payment.method.replaceAll("_", " ")} · {payment.date}</small></span>
            <strong className="finance-overview-payment-list__amount">{formatCurrency(payment.amount)}</strong>
            <Link href={`/finance/print/payment/${payment.id}`} aria-label={`Open receipt for ${payment.reference}`}>Receipt</Link>
          </li>)}
        </ul> : <div className="finance-overview-empty"><strong>No collections in the last 24 months</strong><span>New payments will appear here.</span></div>}
      </article>

      <article className="finance-overview-panel finance-overview-shortcuts">
        <header className="finance-overview-panel__heading"><div><span className="finance-overview-kicker">Workspace</span><h2>Jump into a task</h2><p>Common finance actions</p></div></header>
        <div className="finance-overview-shortcuts__list">
          {financeSections.map((section) => <Link key={section.href} href={section.href}>
            <span className="finance-overview-shortcuts__number">{section.number}</span>
            <span><strong>{section.title}</strong><small>{section.description}</small></span>
            <i aria-hidden="true">→</i>
          </Link>)}
        </div>
      </article>
    </section>
  </>;
}

function financeOverviewAxisValue(max: number) {
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(max)) - 1);
  return Math.ceil(max / magnitude) * magnitude;
}
