<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Schooliva project status

- Current phase: Phase 25 — Responsive PWA
- Schooliva is implemented as a responsive, installable PWA with a safe offline shell and manifest-based app install support.
- Sensitive financial and academic data is not cached offline; the service worker only caches public shell assets and static app resources.
- Mobile, tablet, and desktop layouts prioritize responsive navigation, accessible controls, and smaller touch targets.
- Supabase data remains network-gated and permission-scoped; no private data is cached insecurely.
