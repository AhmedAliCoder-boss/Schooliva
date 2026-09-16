<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Schooliva project status

- Current phase: Phase 13 — Fees and finance
- Fee structures are session/class scoped with numeric money values and due dates.
- Invoices track subtotal, discount, late fee, total, paid, remaining, status, and due date.
- Payments are recorded with references, method, date, received-by, and notes.
- Financial records are never silently deleted; status-driven workflows and audit logs are enforced.
- Finance is protected behind auth and role-based permissions; teachers do not see finance by default.
- Use real Supabase data; no hardcoded fee schedules, collections, or payroll logic.
