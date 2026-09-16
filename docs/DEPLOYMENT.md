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
supabase db push
```

6. Review the migration output and confirm all migrations are applied in order.
7. Run `supabase test db` after installing the CLI and pgTAP support. The Phase 27 and Phase 29 database tests check RLS, integrity, and storage configuration.
8. Create separate production verification users for administrator, teacher, parent, student, accountant, librarian, transport manager, and inventory manager workflows. Do not reuse real user accounts.

## Storage verification

Storage buckets must remain private. The migrations create private buckets for assignment files, submissions, leave attachments, private documents, and generated certificates. Run [phase29_deployment.sql](../supabase/tests/phase29_deployment.sql) and manually verify:

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
- [ ] student, parent, teacher, accountant, finance, attendance, timetable, exams, results, homework, library, transport, inventory, notifications, documents, and reports workflows pass
- [ ] backups and recovery owner are assigned
- [ ] monitoring, error reporting, and rollback plan are documented
- [ ] production smoke test passes over HTTPS
