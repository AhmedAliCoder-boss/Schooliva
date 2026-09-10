# Schooliva architecture

## Product boundary

Schooliva is a modular school management system. Each major domain will own its
UI, validation, data access and business rules. Shared infrastructure will stay
small and explicit so a future Flutter client can use the same Supabase APIs
without depending on Next.js presentation code.

## Planned structure

```text
src/
  app/                    # Next.js routes, layouts and route handlers
  components/             # Shared presentation primitives
  features/               # Domain modules: students, attendance, fees, etc.
  lib/
    supabase/             # Browser/server Supabase client boundaries
    validation/           # Shared Zod schemas as they are introduced
  types/                  # Generated database types and shared contracts
supabase/
  migrations/             # Ordered PostgreSQL schema and RLS migrations
  seed/                   # Development-only seed data, never production data
docs/                     # Architecture decisions and operational notes
```

## Backend strategy

- Supabase PostgreSQL is the system of record.
- Database constraints, foreign keys and indexes protect data integrity.
- Supabase Auth owns identity; application roles and school membership live in
  PostgreSQL tables.
- RLS is the final authorization boundary. Frontend checks are only for UX.
- Generated TypeScript database types will be committed after the initial
  schema is established in Phase 1.

## Authentication and authorization

The planned flow is Auth user -> profile -> school membership -> role and
permissions. Every tenant-owned table will carry the appropriate school key,
and RLS policies will derive access from the authenticated user and membership.
Service-role access, when required for trusted server jobs, will stay server
only and will never be exposed through `NEXT_PUBLIC_*` variables.

## Supabase integration

`src/lib/supabase/client.ts` is the browser boundary and
`src/lib/supabase/server.ts` is the server boundary. Feature modules should
depend on these helpers rather than constructing clients independently. The
database schema and generated types are intentionally deferred to Phase 1.

## Flutter reuse

Flutter will authenticate against Supabase Auth and query the same PostgreSQL
data through Supabase's generated API. Shared contracts should be expressed by
the database schema and API behavior, not by importing web components or
Next.js-specific code.

## Phase 0 decisions

- Next.js App Router with strict TypeScript and `src/` directory.
- Tailwind CSS is available for utility styling; global CSS owns the initial
  visual language.
- Zod, React Hook Form and TanStack Query will be introduced with the first
  feature that needs them, avoiding premature global abstractions.
- No module-specific tables, auth flows, mock data or fake API routes are part
  of this foundation.