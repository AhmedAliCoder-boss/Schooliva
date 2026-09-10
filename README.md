# Schooliva

Schooliva is a production-oriented School ERP foundation built with Next.js,
TypeScript and Supabase. The project is being developed phase-by-phase; Phase 0
establishes architecture, project rules and backend integration boundaries.

## Local setup

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000.

Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to
`.env.local` before using Supabase features. Never add service-role keys to
frontend or `NEXT_PUBLIC_*` variables.

## Useful commands

```powershell
npm run dev
npm run lint
npm run build
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the planned module
boundaries, database strategy, security model and Flutter reuse plan.