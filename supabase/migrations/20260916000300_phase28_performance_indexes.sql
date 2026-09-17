-- Phase 28: indexes observed from production list and reporting query shapes.

create index if not exists students_school_created_at_idx
  on public.students (school_id, created_at desc);

create index if not exists parents_school_created_at_idx
  on public.parents (school_id, created_at desc);

create index if not exists assignments_school_due_date_idx
  on public.assignments (school_id, due_date desc);

create index if not exists fee_invoices_school_due_date_idx
  on public.fee_invoices (school_id, due_date desc);

create index if not exists fee_payments_school_date_idx
  on public.fee_payments (school_id, payment_date desc);

create index if not exists library_transactions_school_due_date_idx
  on public.library_transactions (school_id, due_date desc);

create index if not exists transport_assignments_school_date_idx
  on public.transport_student_assignments (school_id, assigned_on desc);
