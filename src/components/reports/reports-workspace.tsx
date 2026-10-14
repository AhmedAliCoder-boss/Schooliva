import Link from "next/link";

import { formatCurrency } from "@/lib/format/currency";
import type { ReportFilterOptions, SchoolReportSummary } from "@/lib/reports/types";
import { PrintReportButton } from "@/components/reports/print-report-button";

type SelectedFilters = {
  from: string;
  to: string;
  classId: string;
  sectionId: string;
  sessionId: string;
};

function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percent(value: unknown): string {
  return `${number(value).toFixed(1)}%`;
}

function maxOf(values: number[]): number {
  return Math.max(...values, 1);
}

function Bars({ rows, valueKey = "count", currency = false }: {
  rows: Array<{ label: string; [key: string]: string | number }>;
  valueKey?: string;
  currency?: boolean;
}) {
  if (!rows.length) return <p className="reports-empty">No records in this period.</p>;
  const values = rows.map((row) => number(row[valueKey]));
  const max = maxOf(values);
  return <div className="reports-bars">
    {rows.map((row, index) => {
      const value = values[index];
      return <div className="reports-bar-row" key={row.label}>
        <span className="reports-bar-row__label" title={row.label}>{row.label}</span>
        <span className="reports-bar-row__track"><span style={{ width: `${Math.max(value > 0 ? 3 : 0, value / max * 100)}%` }} /></span>
        <strong>{currency ? formatCurrency(value) : value.toLocaleString("en-GB")}</strong>
      </div>;
    })}
  </div>;
}

export function ReportsWorkspace({
  summary,
  options,
  filters,
  schoolName,
}: {
  summary: SchoolReportSummary;
  options: ReportFilterOptions;
  filters: SelectedFilters;
  schoolName: string;
}) {
  const students = summary.student_summary ?? { total_students: 0, active_classes: 0, by_class: [] };
  const attendance = summary.attendance_summary ?? { total_records: 0, present_rate: 0, by_status: [], daily_trend: [] };
  const fees = summary.fee_summary ?? { total_invoices: 0, total_collected: 0, outstanding: 0, by_status: [], collection_trend: [] };
  const results = summary.result_summary ?? { published_exams: 0, average_marks: 0, pass_rate: 0 };
  const teachers = summary.teacher_summary ?? { active_teachers: 0, open_assignments: 0 };
  const library = summary.library_summary ?? { books_total: 0, issued_books: 0, overdue_books: 0 };
  const transport = summary.transport_summary ?? { active_routes: 0, assigned_students: 0 };
  const inventory = summary.inventory_summary ?? { low_stock_items: 0, total_items: 0, stock_value: 0, by_category: [] };
  const sectionOptions = filters.classId
    ? options.sections.filter((section) => section.class_id === filters.classId)
    : options.sections;
  const selectedClass = options.classes.find((item) => item.id === filters.classId)?.name;
  const selectedSection = sectionOptions.find((item) => item.id === filters.sectionId)?.name;
  const selectedSession = options.sessions.find((item) => item.id === filters.sessionId)?.name;
  const query = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    ...(filters.classId ? { classId: filters.classId } : {}),
    ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
    ...(filters.sessionId ? { sessionId: filters.sessionId } : {}),
  }).toString();
  const focus = [selectedSession, selectedClass, selectedSection].filter(Boolean).join(" · ") || "Whole school";
  const periodLabel = `${filters.from} to ${filters.to}`;
  const daily = attendance.daily_trend.slice(-14);
  const dailyMax = maxOf(daily.map((point) => number(point.records)));

  return <main className="reports-page">
    <header className="reports-heading">
      <div className="reports-brand"><span aria-hidden="true">S</span><div><strong>Schooliva</strong><small>{schoolName}</small></div></div>
      <div className="reports-heading__actions reports-no-print">
        <a className="reports-action reports-action--secondary" href={`/reports/export?${query}`}>Download CSV</a>
        <PrintReportButton />
        <Link className="reports-action reports-action--primary" href="/dashboard">Dashboard <span aria-hidden="true">→</span></Link>
      </div>
    </header>

    <section className="reports-hero">
      <div>
        <p className="reports-eyebrow">School intelligence · {focus}</p>
        <h1>School report</h1>
        <p className="reports-hero__description">A live, school-wide snapshot of academic progress, attendance, finance, staffing, and daily operations.</p>
      </div>
      <div className="reports-period-stamp"><span>REPORTING PERIOD</span><strong>{periodLabel}</strong><small>{focus}</small></div>
    </section>
    <div className="reports-print-meta" aria-hidden="true">
      <span>CONFIDENTIAL · SCHOOL PERFORMANCE REPORT</span>
      <strong>{schoolName}</strong>
      <p>Coverage: {periodLabel} · Scope: {focus}</p>
    </div>

    <form className="reports-filters reports-no-print" method="get">
      <label>From<input type="date" name="from" defaultValue={filters.from} required /></label>
      <label>To<input type="date" name="to" defaultValue={filters.to} required /></label>
      <label>Academic session<select name="sessionId" defaultValue={filters.sessionId}><option value="">All sessions</option>{options.sessions.map((session) => <option key={session.id} value={session.id}>{session.name}{session.is_current ? " · Current" : ""}</option>)}</select></label>
      <label>Class<select name="classId" defaultValue={filters.classId}><option value="">All classes</option>{options.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Section<select name="sectionId" defaultValue={filters.sectionId}><option value="">All sections</option>{sectionOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="reports-filter-actions"><button className="reports-action reports-action--primary" type="submit">Apply filters <span aria-hidden="true">→</span></button><Link className="reports-reset" href="/reports">Reset</Link></div>
      <p>Choose up to 367 calendar days. Academic filters apply to enrollment, attendance, fees, assignments, and examination summaries.</p>
    </form>

    <nav className="reports-section-nav reports-no-print" aria-label="Report sections">
      <a href="#overview">Overview</a><a href="#academics">Academic</a><a href="#finance">Finance</a><a href="#operations">Operations</a>
    </nav>

    <section className="reports-section" id="overview" aria-labelledby="overview-heading">
      <div className="reports-section-heading"><div><span>01 · EXECUTIVE SUMMARY</span><h2 id="overview-heading">School at a glance</h2></div><small>{focus} · {periodLabel}</small></div>
      <div className="reports-kpis">
        <article className="reports-kpi reports-kpi--green"><span>Active students</span><strong>{number(students.total_students).toLocaleString("en-GB")}</strong><small>{number(students.active_classes)} active classes</small></article>
        <article className="reports-kpi reports-kpi--blue"><span>Attendance rate</span><strong>{percent(attendance.present_rate)}</strong><small>{number(attendance.total_records).toLocaleString("en-GB")} records in period</small></article>
        <article className="reports-kpi reports-kpi--amber"><span>Fees collected</span><strong>{formatCurrency(fees.total_collected)}</strong><small>{number(fees.total_invoices)} invoices created in period</small></article>
        <article className="reports-kpi reports-kpi--rose"><span>Outstanding fees</span><strong>{formatCurrency(fees.outstanding)}</strong><small>Unpaid balances across matching students</small></article>
        <article className="reports-kpi reports-kpi--violet"><span>Exam pass rate</span><strong>{percent(results.pass_rate)}</strong><small>{number(results.published_exams)} published exams in period</small></article>
        <article className="reports-kpi reports-kpi--orange"><span>Low-stock items</span><strong>{number(inventory.low_stock_items)}</strong><small>of {number(inventory.total_items)} active inventory items</small></article>
      </div>
    </section>

    <section className="reports-section" id="academics" aria-labelledby="academics-heading">
      <div className="reports-section-heading"><div><span>02 · ACADEMIC PERFORMANCE</span><h2 id="academics-heading">Learning and attendance</h2></div></div>
      <div className="reports-panels reports-panels--academic">
        <article className="reports-panel reports-panel--wide">
          <div className="reports-panel-heading"><div><span>DAILY ATTENDANCE</span><h3>Presence trend</h3></div><b>{percent(attendance.present_rate)}</b></div>
          {daily.length ? <div className="reports-trend" role="img" aria-label="Attendance record volume by day">
            {daily.map((point) => <div className="reports-trend__column" key={point.date} title={`${point.date}: ${point.records} records`}>
              <span style={{ height: `${Math.max(point.records ? 4 : 1, number(point.records) / dailyMax * 100)}%` }} />
              <small>{point.date.slice(5)}</small>
              <em>{number(point.records).toLocaleString("en-GB")}</em>
            </div>)}
          </div> : <p className="reports-empty">No attendance records in this period.</p>}
          <p className="reports-panel-note">Showing the most recent 14 days in the selected period. Attendance rate counts present, half-day, and late records.</p>
        </article>
        <article className="reports-panel">
          <div className="reports-panel-heading"><div><span>ATTENDANCE MIX</span><h3>By status</h3></div><b>{number(attendance.total_records).toLocaleString("en-GB")}</b></div>
          <Bars rows={attendance.by_status} />
        </article>
        <article className="reports-panel">
          <div className="reports-panel-heading"><div><span>ASSESSMENT</span><h3>Results snapshot</h3></div><b>{number(results.published_exams)} exams</b></div>
          <div className="reports-stat-list"><div><span>Average score</span><strong>{percent(results.average_marks)}</strong></div><div><span>Pass rate</span><strong>{percent(results.pass_rate)}</strong></div><div><span>Open assignments</span><strong>{number(teachers.open_assignments)}</strong></div></div>
        </article>
        <article className="reports-panel reports-panel--wide">
          <div className="reports-panel-heading"><div><span>ENROLLMENT DISTRIBUTION</span><h3>Students by class and section</h3></div><b>{number(students.total_students).toLocaleString("en-GB")} students</b></div>
          <Bars rows={students.by_class} valueKey="students" />
        </article>
      </div>
    </section>

    <section className="reports-section" id="finance" aria-labelledby="finance-heading">
      <div className="reports-section-heading"><div><span>03 · FINANCIAL HEALTH</span><h2 id="finance-heading">Collections and balances</h2></div></div>
      <div className="reports-panels reports-panels--finance">
        <article className="reports-panel">
          <div className="reports-panel-heading"><div><span>INVOICE STATUS</span><h3>Billing breakdown</h3></div><b>{number(fees.total_invoices)} invoices</b></div>
          <Bars rows={fees.by_status} />
          <div className="reports-finance-total"><span>Outstanding balance</span><strong>{formatCurrency(fees.outstanding)}</strong></div>
        </article>
        <article className="reports-panel">
          <div className="reports-panel-heading"><div><span>PAYMENT HISTORY</span><h3>Collections in period</h3></div><b>{formatCurrency(fees.total_collected)}</b></div>
          <Bars rows={fees.collection_trend.map((point) => ({ label: point.label, amount: number(point.amount) }))} valueKey="amount" currency />
          <p className="reports-panel-note">Collection totals use payment dates; invoice totals use creation dates.</p>
        </article>
      </div>
    </section>

    <section className="reports-section" id="operations" aria-labelledby="operations-heading">
      <div className="reports-section-heading"><div><span>04 · SCHOOL OPERATIONS</span><h2 id="operations-heading">People, resources, and movement</h2></div></div>
      <div className="reports-operations-grid">
        <article className="reports-operation-card"><span className="reports-operation-icon">01</span><div><small>PEOPLE</small><h3>{number(teachers.active_teachers)} active teachers</h3><p>{number(teachers.open_assignments)} assignments opened in the selected period.</p></div></article>
        <article className="reports-operation-card"><span className="reports-operation-icon">02</span><div><small>LIBRARY</small><h3>{number(library.books_total)} catalogued titles</h3><p>{number(library.issued_books)} currently issued · {number(library.overdue_books)} overdue.</p></div></article>
        <article className="reports-operation-card"><span className="reports-operation-icon">03</span><div><small>TRANSPORT</small><h3>{number(transport.active_routes)} active routes</h3><p>{number(transport.assigned_students)} students have active route assignments.</p></div></article>
        <article className="reports-operation-card"><span className="reports-operation-icon">04</span><div><small>INVENTORY</small><h3>{formatCurrency(inventory.stock_value)} stock value</h3><p>{number(inventory.total_items)} active items · {number(inventory.low_stock_items)} at or below minimum stock.</p></div></article>
      </div>
      <article className="reports-panel reports-inventory-panel">
        <div className="reports-panel-heading"><div><span>INVENTORY DISTRIBUTION</span><h3>Stock by category</h3></div></div>
        <Bars rows={inventory.by_category.map((row) => ({ label: `${row.label} · ${row.items} items`, value: number(row.value) }))} valueKey="value" currency />
      </article>
    </section>

    <footer className="reports-footer"><span>Schooliva · {schoolName}</span><span>Generated from live school records · {periodLabel}</span></footer>
  </main>;
}
