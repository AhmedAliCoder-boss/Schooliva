# Schooliva production deployment

## Release status

The application build and static checks are reproducible locally. Production readiness still requires a real Supabase project verification with the deployment checklist below. Do not ship until authentication, RLS, storage, and critical workflows pass with production-like test accounts.

## Free-tier deployment shape

- Frontend: Vercel Hobby or another Next.js-compatible host
- Database/Auth/Storage: Supabase Free tier
- Source control and CI: GitHub Actions Free tier
- Domain: an existing domain, or the host-provided HTTPS URL

Free tiers have quotas and sleeping/pausing limits. Review current provider limits before promising uptime or backup retention.

## Environment variables

### Vercel or production frontend

Set these as encrypted hosting variables for Production, Preview, and Development as appropriate:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase publishable/anon key only
- `NEXT_PUBLIC_SITE_URL`: canonical HTTPS application origin, for example `https://schooliva.example`
- `ADMIN_CONTACT_EMAIL`: administrator email address used by the sign-in help form's email draft. Configure it for local and production environments.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service-role key required for managed account creation and Auth email/password/status operations, private profile-photo administration, and resolving username/User-ID sign-ins. Keep it encrypted in the hosting provider and never use a `NEXT_PUBLIC_` prefix.

Direct admin password updates remain unavailable until `SUPABASE_SERVICE_ROLE_KEY` is configured for the server environment. The key is used only by the server-side Supabase Auth Admin API; it is never sent to the browser.

Never set a service-role key under `NEXT_PUBLIC_*`. The frontend does not require a service-role key.

### Local development

```powershell
Copy-Item .env.example .env.local
# edit .env.local with the project URL, publishable key, and local site URL
npm install
npm run dev
```

`.env.local`, mobile `.env`, build output, and test credentials are ignored by Git. Run `git ls-files "*.env*"` before a release and confirm only templates such as `.env.example` are listed.

## Supabase production setup

1. Create a Supabase project and record the project reference.
2. In Authentication, set the Site URL to `NEXT_PUBLIC_SITE_URL`.
3. Add only the HTTPS production origin and required callback URLs under Additional Redirect URLs.
4. Configure email provider, sender identity, confirmation, recovery, and password policies.
5. Link the repository from a workstation with the Supabase CLI:

```powershell
supabase login
supabase link --project-ref <project-ref>
supabase migration list --linked
supabase db push --linked --skip-vault
```

6. Confirm that the linked project is the intended live Supabase project and review the migration list before pushing. `--skip-vault` avoids changing project Vault secrets as a side effect. Confirm every migration is applied afterward. The Admissions module requires both `20261005000100_admissions_module.sql` and `20261005000200_admissions_workflows.sql`; deploy them before opening Admissions, or the API will report that `public.admissions` is missing from the schema cache.
   `20261006000100_dashboard_profiles_and_user_management.sql` adds the private profile-avatar bucket. `20261006000200_account_management_rebuild.sql` extends the existing profiles/RBAC schema with unique application User IDs, account statuses, scoped account-management RPCs, and account audit history; apply it before deploying code that calls those RPCs. `20261011000600_hrm_employee_id_format.sql` aligns HRM employee codes with the school-prefixed User ID sequence. `20261011000700_hrm_account_requests_and_scoped_creation.sql` adds Master Admin-reviewed employee-account requests, separates hiring from login creation, and limits direct School Admin account creation to lower-level roles within the selected school. `20261011000800_hrm_employee_document_upload_review.sql` adds school-scoped employee-document upload policies and document verification states. Apply all HRM migrations before deploying the HRM account and verification workflow. Employee verification uploads are submitted one file per request; keep each file within the configured 5 MB limit. `20261010000100_school_expenses.sql` adds the school-scoped expense register and its finance-permission RLS policies; apply it before deploying the Finance expenses page. `20261010000200_school_payroll.sql` adds payroll policies, compensation, attendance-based runs, and salary-expense settlement. `20261010000300_payroll_policy_snapshot.sql` preserves each payroll run's attendance deduction rules for itemized salary slips; apply both payroll migrations before deploying payroll pages. `20261012000100_enforce_school_timetable_working_days.sql` adds school-scoped working-day configuration and database enforcement for active timetable lessons; apply it before deploying the timetable working-days controls. `20261012000200_exam_timetable_terms_examiners.sql` adds term and examiner assignments to exam schedules and prevents examiner time conflicts; apply before deploying the exam timetable builder.
   `20261012000300_exam_workflow_gates.sql` enforces exam workflow gates. `20261012000800_section_exam_workflows.sql` tracks submission, review, and publication independently for each section and keeps the overall exam pending until all active sections finish; `20261012000900_lock_marks_by_section_status.sql` locks marks when their section leaves marking; `20261012001000_fix_exam_mark_guard_variable_ambiguity.sql` avoids an ambiguous PL/pgSQL variable reference in the live marks guard. Apply these before deploying the section-scoped exam workflow.
   `20261013000100_student_report_card_fields.sql` exposes each published student's Schooliva ID and subject passing marks for individual printable report cards.
   `20261013000200_hrm_employee_terminations.sql` creates the school-scoped employee exit-history table. `20261013000300_hrm_employee_exit_workflow.sql` upgrades it to a request/review workflow and adds private supporting-document storage. `20261014000100_hrm_exit_action_types.sql` distinguishes resignation, school termination, and formal warning cases. Approved resignations and terminations archive the employee and revoke only that school's roles; an approved warning is retained as a disciplinary record without archiving the employee or removing access.
   `20261014000200_student_identifier_school_class_section.sql` backfills Schooliva student IDs to use the school code, current class ordinal, section code initial, and the existing school-wide four-digit sequence. The class/section prefix updates with active enrollment changes.
   `20261012000400_exam_type_access_policies.sql` restores the school-scoped exam-type read and manager policies required to create exam types and select them when creating exams.
   `20261012000500_teacher_subject_hire_assignments.sql` records subject, academic session, and optional class assignments atomically when a teacher is hired; apply it before deploying the updated HRM hiring form.
   `20261012000600_timetable_teacher_assignment_read_policy.sql` allows timetable viewers to read the teacher-subject assignments needed to offer class- and session-appropriate teachers in lesson schedules.
   `20261012000700_add_exam_subject_to_class.sql` lets exam managers select any active school subject and atomically add it to the exam class and shared class-subject catalog.
7. Run `supabase test db` after installing the CLI and pgTAP support. The Phase 27 and Phase 29 database tests check RLS, integrity, and storage configuration.
8. Create separate production verification users for administrator, teacher, parent, student, accountant, librarian, transport manager, and inventory manager workflows. Do not reuse real user accounts.

## Storage verification

Storage buckets must remain private. The migrations create private buckets for assignment files, submissions, leave attachments, admission documents, private documents, generated certificates, and profile avatars. Profile photos are readable only by their owner and are displayed using short-lived signed URLs. Run [phase29_deployment.sql](../supabase/tests/phase29_deployment.sql) and manually verify:

- unauthenticated downloads fail
- a file owner can access only their permitted file
- teachers cannot read unrelated private documents
- students cannot read another student’s submission
- signed URLs expire as configured
- MIME and size limits are enforced

## Frontend release

```powershell
npm ci
npm run lint
npm run test:unit
npm run build
```

Configure the host with:

- Build command: `npm run build`
- Start command: `npm run start`
- Node version compatible with the lockfile and Next.js version
- HTTPS enabled
- Preview deployments using a non-production Supabase project where possible

Run the Playwright suite against the deployed preview with `npm run test:e2e` and configured `E2E_*` variables.

## Go-live checklist

- [ ] `npm ci`, lint, unit tests, TypeScript/build pass
- [ ] no service-role key or test credential is tracked
- [ ] production env variables are encrypted and scoped correctly
- [ ] all migrations are applied to the intended Supabase project
- [ ] RLS and RBAC integration tests pass with separate schools
- [ ] storage bucket and object policy checks pass
- [ ] sign-in, recovery, sign-out, and protected redirects work
- [ ] Master Admin and school account-manager workflows respect platform and school boundaries
- [ ] account creation, status changes, username/User-ID login, and account audit entries are smoke-tested with a dedicated non-production account
- [ ] employee case documents are private; resignation, termination, and warning approvals work as intended; warnings keep employees active, and approved exits retain history while revoking only school-scoped roles
- [ ] student, parent, teacher, accountant, finance, admissions, attendance, timetable, exams, results, homework, library, transport, inventory, notifications, documents, and reports workflows pass
- [ ] backups and recovery owner are assigned
- [ ] monitoring, error reporting, and rollback plan are documented
- [ ] production smoke test passes over HTTPS
