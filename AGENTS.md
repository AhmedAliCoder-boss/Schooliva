<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Schooliva project status

- Current phase: Phase 15 — Library management
- Library catalog includes books, authors, categories, publishers, ISBN, copies, and availability.
- Members support both students and teachers with tracked membership data.
- Book circulation tracks issue, return, due date, overdue, and fine calculations.
- Unavailable copies cannot be issued; circulation uses transaction-safe database checks.
- Library inventory, issued books, overdue books, search, and reports are provided through protected library workflows.
- Use real Supabase data; no hardcoded inventory, borrowed items, or circulation records.
