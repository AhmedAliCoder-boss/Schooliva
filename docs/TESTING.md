# Phase 27 testing strategy

## Test layers

### Unit tests

Run with `npm run test:unit`. These tests are deterministic and do not need Supabase:

- redirect allowlists and unsafe redirect rejection
- upload MIME and size validation
- fee structure, invoice, and payment schema validation
- positive payment amounts, supported methods, UUIDs, and due-day bounds
- SLC/TC and School Completion Certificate identity, certificate dates, leaving/completion details, and fee status validation

Unit tests belong in `tests/unit` and should cover pure validators, calculations, parsers, and view-model mapping.

### Integration tests

Run with `npm run test:integration` and a dedicated Supabase test project. Integration tests must use only the publishable/anon key and separate fixture users. Never use a service-role key.

Required fixture variables:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `TEST_SCHOOL_A_ID`, `TEST_SCHOOL_B_ID`
- `TEST_PARENT_STUDENT_A_ID`, `TEST_PARENT_STUDENT_B_ID`, `TEST_OTHER_STUDENT_ID`, `TEST_UNAUTHORIZED_CLASS_ID`
- `TEST_PARENT_EMAIL`, `TEST_PARENT_PASSWORD`
- `TEST_STUDENT_EMAIL`, `TEST_STUDENT_PASSWORD`
- `TEST_TEACHER_EMAIL`, `TEST_TEACHER_PASSWORD`
- `TEST_ACCOUNTANT_EMAIL`, `TEST_ACCOUNTANT_PASSWORD`

The integration suite verifies:

- authentication succeeds only for valid credentials
- school A users cannot read school B rows
- parents can read linked children but not unrelated students
- students can read their own records but not another student’s records or marks
- teachers cannot read timetable rows for unauthorized classes
- accountants retain finance access but cannot read academic classes or exams
- RLS returns no unauthorized rows without relying on frontend hiding

### Database tests

Run with `npm run test:db` after installing the Supabase CLI and starting the local database. `supabase/tests/phase27_security_integrity.sql` uses pgTAP to verify RLS on every sensitive domain, authorization policies, notification recipient scoping, payment uniqueness, overpayment protection, inventory movement validation, and library issue locking.

The database fixture should additionally run concurrent transactions for:

- two payments using the same reference, expecting one unique-constraint failure
- two issues for one library copy, expecting one availability failure
- concurrent stock-outs, expecting no negative inventory
- duplicate student enrollment, timetable, exam subject, invoice, and parent-link inserts, expecting constraint failures

## Critical E2E journeys

Run with `npm run test:e2e`. Set `E2E_BASE_URL`, `E2E_USER_EMAIL`, and `E2E_USER_PASSWORD`. The Playwright suite covers:

1. anonymous access to protected dashboard redirects to sign-in
2. valid sign-in reaches dashboard or required setup
3. authenticated users can open student records without server errors
4. finance and reports routes remain protected by server-side authorization
5. role-specific fixtures should repeat the journey for teacher, parent, student, and accountant accounts
6. a parent must not see another child’s profile, attendance, fees, or results
7. a student must not see another student’s profile or marks
8. a teacher must not see or mutate an unassigned class
9. an accountant must not access academic administration screens

## Domain coverage matrix

| Domain | Unit | Integration/RLS | Critical E2E |
| --- | --- | --- | --- |
| Authentication | validators, auth error mapping | valid/invalid login, session expiry | sign-in, sign-out, protected redirect |
| Authorization | safe redirects, permission helpers | denied role and tenant access | protected route behavior |
| RBAC | role normalization | role-permission matrix | teacher/parent/student/accountant journeys |
| RLS | query guard helpers | every tenant and personal boundary | no cross-school UI leakage |
| Students | form/schema mapping | parent/self/staff visibility | list, create, archive, profile |
| Parents | relationship validation | linked-child-only access | parent child switcher |
| Teachers | assignment mapping | class assignment scope | teacher workspace |
| HRM | hiring, resignation/termination/warning request, review-decision, and effective-date schemas | request submission requires recruitment and employee-type manage permissions; only the school's School Admin or Principal may decide; approvals retain employee/history records and only resignation/termination revokes school roles | select an employee and inspect the full record and ID card; submit a resignation or termination with supporting document, then verify approval archives/revokes access; approve a warning and verify the employee remains active with access; verify rejection leaves employment unchanged |
| Attendance | status/date validation | student/parent/teacher scope | record and review attendance |
| Timetable | time/range validation | class/teacher/student scope | view timetable |
| Exams and results | per-section schedule coverage and aggregate workflow status; unambiguous marks-guard variables; weighted report-card totals, class positions, 40% default pass marks, and published pass/fail/position-holder statistics | marks are limited to submitted sections; published-results visibility | submit, mark, review, and publish sections independently; search published exams and filter by academic session; verify overview statistics follow filters; search published students by name, ID, class, or section; open and print individual reports; verify an eight-subject report fits one A4 page |
| Results | mark range calculations | parent/student visibility | published results |
| Fees | invoice/payment schemas and totals; anchored monthly/quarterly/yearly schedules, class/section paid-pending-partial statistics, and management invoice line items | parent/student/accountant scope | manual invoices and payments; verify paid, pending, and partially paid counts and amounts per class and section while changing filters; schedule an enrolled student, verify joining-date catch-up and daily due generation, pause/resume the schedule, and print an itemized non-student management invoice |
| Payments | positive amount/reference rules | duplicate and overpayment rejection | record payment |
| Homework | assignment schemas | class/section/student scope | create, submit, review |
| Library | circulation state rules | member and librarian scope | issue, return, unavailable copy |
| Transport | fleet bounds, stop coordinates and sequence times, assignment status, fee bounds | school-scoped fleet, route, stop, student, and fee access; capacity guard and route-stop membership | create fleet/driver/route, sequence stops, assign a student within capacity, change assignment/vehicle status, review fee plans |
| Inventory | quantity calculations | manager/report access | stock in/out and low stock |
| Food & Cafeteria | menu, date, stock movement, recipe, order-line, and payment validation | school-scoped cafeteria manager access; atomic recipe stock deduction, daily portion caps, order status transitions, and no overpayment | schedule today's menu, configure recipe ingredients, accept a multi-item sale, verify stock deduction and partial/full payment collection, advance preparing → ready → served, and confirm low-stock alerts |
| Notifications | role announcement validation, event recipient mapping | recipient-only reads, active-role targeting, per-event opt-out | poll the global bell from dashboard and other workspaces, confirm new items open an on-screen alert, mark one/all read, send announcements to selected active roles, and verify absence/invoice/payment/assignment/leave notifications reach the intended accounts |
| Documents | upload validation | owner/role/storage scope | upload and download |
| Reports | filter parsing, invalid date/UUID handling, and bounded date ranges | report RPC and filter-option access are permission-checked and school-scoped | compare all-school and class/section/session-filtered summaries; verify attendance, fee, results, and inventory breakdowns; export the same filtered data to CSV and print the branded A4 landscape report |

## Failure policy

A failing test is triaged as one of:

- product defect: fix code or migration
- fixture defect: repair isolated test data
- environment defect: fail the targeted command with a clear prerequisite message

Tests must not be weakened by removing assertions, using a service role, or hiding authorization errors with frontend conditions.
