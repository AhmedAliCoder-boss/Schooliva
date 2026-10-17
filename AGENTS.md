<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Schooliva project status

- Current phase: Phase 26 — Read-only offline viewing
- Schooliva is a responsive, installable PWA with a public offline fallback and read-only caching for recently opened, authenticated pages.
- Private page caches are scoped to the authenticated user and selected school, expire after 24 hours, and are cleared on sign-out or account/school scope changes.
- Offline form submissions are blocked with a connection status message; Supabase writes remain online-only.
- Mobile, tablet, and desktop layouts prioritize responsive navigation, accessible controls, and smaller touch targets.
- Supabase data remains permission-scoped; offline page snapshots are device-local and may contain private school information.
