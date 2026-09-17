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