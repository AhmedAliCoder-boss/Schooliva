# Phase 28 performance audit

## Baseline

Measured on 2026-09-16 from the repository root:

- `npm run build` completed successfully.
- Next.js reported 40 generated routes.
- Production compilation: about 1.2 seconds.
- TypeScript validation: about 4.7 seconds.
- Static page generation: about 1.3 seconds.
- `.next/static` remains the correct source for bundle-size comparison; no bundle-size regression is accepted without a before/after artifact report.

The query audit inspected every server page and action for wildcard selects, unbounded lists, Promise fan-out, in-memory filtering, and realtime subscriptions.

## Findings and changes

### Database access

- Most list pages already use selective columns, `Promise.all`, and pagination.
- Student, teacher, parent, staff profile, and published-result pages had wildcard responses. Student and published-result views now request only consumed fields; the remaining people-profile wildcard selects are isolated follow-up candidates because their form field contracts are broader.
- No N+1 loop was found in the server pages inspected. Detail pages use parallel relationship queries rather than querying per rendered row.
- No unnecessary Supabase realtime subscription was found.
- Added indexes matching observed tenant-first access paths and sort keys: student creation, parent creation, assignment due date, invoice due date, payment date, library due date, and transport assignment date.
- RLS predicates remain unchanged by indexes; tenant and role checks still execute at the database boundary.

### Responses and pagination

- Existing list routes use bounded ranges on students, parents, staff, and setup records.
- Notifications and audit logs cap responses at 100 rows.
- Reports use server-side aggregate RPCs rather than transferring raw records for summary cards.
- Private authenticated data is intentionally not cached in Next.js or the service worker. This avoids stale or cross-user data exposure.

### Frontend and bundle strategy

- Server components keep data-fetching pages out of the client bundle.
- Interactive forms are isolated client components and already use native server actions.
- Playwright is configured for critical route checks; bundle-size budgets should be added when a production bundle analyzer is introduced.
- Do not add memoization or realtime channels without a measured render/request regression.

## Measurement commands

```powershell
npm run build
npm run test:unit
npm run lint
Get-ChildItem .next/static -Recurse -File | Measure-Object -Property Length -Sum
```

For database plans, run `EXPLAIN (ANALYZE, BUFFERS)` against representative tenant-scoped queries in a non-production Supabase database. Compare before and after the Phase 28 indexes and inspect `pg_stat_statements` for high total time, call count, and rows returned.

## Follow-up performance gates

- Add `EXPLAIN` fixtures for attendance reports, dashboard summary, fee invoice lists, library transactions, and transport assignments.
- Add route-level request timing in staging, excluding sensitive values and user identifiers.
- Add a CI bundle budget when chunk artifacts are stable across Next.js upgrades.
- Add paginated UI controls to finance, library, transport, and audit tables before raising their result caps.
- Keep an explicit prohibition on caching authenticated Supabase responses unless the cache key includes the full user and school authorization context and invalidation is tested.
