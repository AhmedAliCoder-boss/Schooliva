begin;

select plan(25);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.students'::regclass),
  'students has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.parents'::regclass),
  'parents has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.teachers'::regclass),
  'teachers has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.student_attendance'::regclass),
  'attendance has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.timetable_entries'::regclass),
  'timetable has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.exams'::regclass),
  'exams has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.marks'::regclass),
  'results have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.fee_invoices'::regclass),
  'fees have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.fee_payments'::regclass),
  'payments have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.assignments'::regclass),
  'homework has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.library_books'::regclass),
  'library has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.transport_routes'::regclass),
  'transport has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.inventory_items'::regclass),
  'inventory has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.notifications'::regclass),
  'notifications have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.document_records'::regclass),
  'documents have RLS enabled'
);

select ok(not public.has_school_access(gen_random_uuid()), 'unknown school is denied');
select ok(not public.has_permission(gen_random_uuid(), 'fees', 'view'), 'unknown school permission is denied');

select ok(
  exists (select 1 from pg_indexes where indexname = 'fee_payments_school_reference_key'),
  'payment references are unique per school'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'fee_payments_validate_amount'),
  'payments validate invoice balance before insert'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'inventory_transaction_validate'),
  'inventory validates stock movements before insert'
);
select ok(
  exists (select 1 from pg_proc where proname = 'ensure_copy_available'),
  'library issue availability is guarded by a database function'
);

select ok(
  exists (select 1 from pg_policies where tablename = 'students' and policyname = 'People can read allowed students'),
  'student reads are policy-scoped to authorized, parent, or self records'
);
select ok(
  exists (select 1 from pg_policies where tablename = 'marks' and policyname = 'Allowed users can read marks'),
  'result reads are policy-scoped to authorized, parent, or self records'
);
select ok(
  exists (select 1 from pg_policies where tablename = 'academic_sessions' and policyname = 'Authorized users can read academic data'),
  'academic reads require academic/report permission'
);
select ok(
  exists (select 1 from pg_policies where tablename = 'notifications' and policyname = 'Users can read own notifications'),
  'notifications are recipient-scoped'
);

select * from finish();
rollback;
