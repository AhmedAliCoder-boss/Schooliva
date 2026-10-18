# Schooliva

Schooliva is a multi-tenant school operations platform built with Next.js,
TypeScript, Supabase Auth, PostgreSQL, RLS, Storage, and a Flutter client.
Supabase is the system of record. The web and mobile clients never contain a
service-role key and do not replace database authorization.

## Quick start

Requirements: Node.js compatible with the lockfile, npm, and a Supabase project.

```powershell
npm ci
Copy-Item .env.example .env.local
# edit .env.local with the Supabase URL, publishable/anon key, and site URL
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

Required web variables:

- `NEXT_PUBLIC_SUPABASE_URL`: project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: publishable/anon key only
- `NEXT_PUBLIC_SITE_URL`: canonical app origin; use HTTPS in production
- `SUPPORT_EMAIL_TO`: support inbox recipient (defaults to the configured Schooliva support contact)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`: optional SMTP delivery for support requests and review updates
- `SMTP_SECURE`: optional `true`/`false`; defaults to secure TLS on port 465
- `SMTP_FROM`: optional approved sender address; defaults to `SMTP_USER`

Support requests are stored in the Schooliva in-app Master Admin inbox even
when SMTP is not configured. Configure the SMTP variables in the deployment
environment to enable email alerts. Apply
`supabase/migrations/20261018000200_school_support_center.sql` before enabling
the Support section. Never paste SMTP credentials into chat or commit them.

The Master Admin overview can prepare a free monthly WhatsApp summary of
outstanding school bills and student promotions completed in the prior month.
Enter the recipient number in the overview; it is saved only in that browser.
This opens a prefilled WhatsApp draft and requires a manual Send action. It does
not schedule messages or use the WhatsApp API.

Academic planning connects session curriculum mappings to unit plans, dates,
lesson targets, assessments, teacher assignments, completion tracking, and
teaching reflections. Apply
`supabase/migrations/20261018000300_academic_planning.sql` to enable the module.

Keep `.env.local`, test credentials, and mobile `.env` files out of Git. Never
use `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_*` variables or browser/mobile
code. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for host configuration.

## Commands

```powershell
npm run dev
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:db
npm run build
```

Integration, E2E, and database tests require dedicated fixtures or the Supabase
CLI as described in [docs/TESTING.md](docs/TESTING.md).

## Database and deployment

Link the Supabase CLI to the intended project and apply migrations in order:

```powershell
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

Deploy the Next.js app to Vercel or another compatible host using `npm ci` and
`npm run build`. The repository includes [vercel.json](vercel.json).

Read:

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/BACKUP_RECOVERY.md](docs/BACKUP_RECOVERY.md)
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- [docs/TESTING.md](docs/TESTING.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)