<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Schooliva project status

- Current phase: Phase 12 — Results and report cards
- Published results are the only result set exposed to students/parents.
- Exam workflow states: draft -> submitted -> reviewed -> published.
- Grading is configurable via grading scales and grade boundaries.
- All protected pages remain behind auth and RBAC/RLS checks.
- Use real Supabase data; no hardcoded attendance, timetable, curriculum, or result statistics.
