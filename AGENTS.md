<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Schooliva project status

- Current phase: Phase 18 — Leave management
- Leave requests support students, teachers, and staff with leave types, dates, reasons, attachments, approvers, and workflow states.
- Workflow states are requested -> approved/rejected -> completed.
- Leave visibility is protected by requester, subject, approver, and school-scoped RLS rules.
- Leave attachments use the private Supabase Storage bucket `leave-attachments`.
- Leave dashboard summaries use real Supabase data; no hardcoded leave counts.
