<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Schooliva project status

- Current phase: Phase 16 — Transport management
- Transport module manages vehicles, capacity, drivers, routes, stops, student route assignments, and transport fees.
- Vehicle capacity is enforced at the database layer to prevent assigning students beyond seat limits.
- Route assignment includes pickup and drop-off stop tracking with school-scoped route mappings.
- Transport reports and fleet status are protected behind auth and RBAC/RLS.
- GPS integration is intentionally not implemented yet; architecture remains ready for future location-aware features.
- Use real Supabase data; no hardcoded vehicles, route assignments, or transport fee data.
