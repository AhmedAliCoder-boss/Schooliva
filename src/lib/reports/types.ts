export type ReportBar = { label: string; count: number };
export type ReportClassBreakdown = { label: string; students: number };
export type ReportDailyPoint = { date: string; records: number; present: number };
export type ReportCollectionPoint = { label: string; amount: number };
export type ReportInventoryCategory = { label: string; items: number; quantity: number; value: number };

export type SchoolReportSummary = {
  report_period?: { from_date: string; to_date: string };
  student_summary?: { total_students: number; active_classes: number; by_class: ReportClassBreakdown[] };
  attendance_summary?: { total_records: number; present_rate: number; by_status: ReportBar[]; daily_trend: ReportDailyPoint[] };
  fee_summary?: { total_invoices: number; total_collected: number; outstanding: number; by_status: ReportBar[]; collection_trend: ReportCollectionPoint[] };
  result_summary?: { published_exams: number; average_marks: number; pass_rate: number };
  teacher_summary?: { active_teachers: number; open_assignments: number };
  library_summary?: { books_total: number; issued_books: number; overdue_books: number };
  transport_summary?: { active_routes: number; assigned_students: number };
  inventory_summary?: { low_stock_items: number; total_items: number; stock_value: number; by_category: ReportInventoryCategory[] };
};

export type ReportFilterOptions = {
  classes: Array<{ id: string; name: string }>;
  sections: Array<{ id: string; name: string; class_id: string }>;
  sessions: Array<{ id: string; name: string; is_current: boolean }>;
};
