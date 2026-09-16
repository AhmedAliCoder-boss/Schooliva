<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Schooliva project status

- Current phase: Phase 23 — Search, reporting, and export
- Global search is server-side and permission-scoped so only authorized records appear.
- Search covers students, teachers, parents, classes, invoices, books, and assignments.
- Reports are generated from database summary functions and allow filters for date ranges, classes, sections, and academic sessions.
- Export-friendly layouts and print-ready reports are kept server-side and avoid loading whole tables into the browser.
