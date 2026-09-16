# Phase 27 testing strategy

## Test layers

### Unit tests

Run with `npm run test:unit`. These tests are deterministic and do not need Supabase:

- redirect allowlists and unsafe redirect rejection
- upload MIME and size validation
- fee structure, invoice, and payment schema validation
- positive payment amounts, supported methods, UUIDs, and due-day bounds

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
| Attendance | status/date validation | student/parent/teacher scope | record and review attendance |
| Timetable | time/range validation | class/teacher/student scope | view timetable |
| Exams | workflow transitions | published-results visibility | create, review, publish |
| Results | mark range calculations | parent/student visibility | published results |
| Fees | invoice/payment schemas and totals | parent/student/accountant scope | invoice and payment flow |
| Payments | positive amount/reference rules | duplicate and overpayment rejection | record payment |
| Homework | assignment schemas | class/section/student scope | create, submit, review |
| Library | circulation state rules | member and librarian scope | issue, return, unavailable copy |
| Transport | assignment validation | route/student scope | route assignment |
| Inventory | quantity calculations | manager/report access | stock in/out and low stock |
| Notifications | payload validation | recipient-only reads | unread and mark-read |
| Documents | upload validation | owner/role/storage scope | upload and download |
| Reports | filter parsing | permission and tenant scope | report access/export |

## Failure policy

A failing test is triaged as one of:

- product defect: fix code or migration
- fixture defect: repair isolated test data
- environment defect: fail the targeted command with a clear prerequisite message

Tests must not be weakened by removing assertions, using a service role, or hiding authorization errors with frontend conditions.
