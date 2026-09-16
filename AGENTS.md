<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Schooliva project status

- Current phase: Phase 20 — Documents and certificates
- Document metadata is stored in PostgreSQL while binaries remain in private Supabase Storage buckets.
- Student, teacher, and school document access is protected with RLS and storage ownership rules.
- Certificate records support character, bonafide, leaving, and enrollment certificate types.
- Certificates have secure references, issue status, and print-friendly templates.
- Use real Supabase document metadata; never store uploaded file binaries in relational tables.
