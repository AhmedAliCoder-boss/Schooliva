# Phase 1 database foundation

The migration in `supabase/migrations/20260911000100_initial_database_foundation.sql`
creates the first normalized Schooliva schema. It deliberately stops before
attendance, fees, exams, library, transport and other future domains.

## Entity relationships

- `auth.users` is owned by Supabase Auth. `profiles.id` references the same
  UUID, so application profile data never stores passwords.
- A `school` is the tenant boundary. School-owned records carry `school_id`.
- A school can have many `academic_sessions`; each session can have many
  `academic_terms`.
- A school has many `classes`; each class has many `sections`.
- `subjects` are assigned to classes through `class_subjects`.
- `students`, `parents`, `teachers` and `staff` belong to a school.
- `student_parents` is the many-to-many relationship between students and
  parents, with a single optional primary parent per student.
- `student_enrollments` connects a student to one academic session, class and
  section. Its composite foreign keys prevent cross-school references and also
  ensure the section belongs to the selected class and term to the selected
  academic session.
- `permissions` describe allowed actions. `role_permissions` maps permissions
  to roles, and `user_roles` assigns roles to users within a school.
- Roles may be global templates (`school_id` is null) or school-specific. A
  trigger prevents a school-specific role from being assigned to another school.

## Integrity and query design

The migration uses UUID identifiers, foreign keys, composite tenant-safe
foreign keys, unique constraints, date/status checks, partial unique indexes
for current records, and indexes for common school, name, enrollment and join
table queries.

## Timestamps and soft deletion

Mutable entities have UTC `created_at` and `updated_at` timestamps maintained by
a shared trigger. People records that may need historical retention use
`is_active` plus nullable `deleted_at`; application queries should exclude rows
with `deleted_at` by default. Enrollment history is retained through status and
withdrawal timestamps rather than deleting past enrollments.

## Auditability and security

RLS is enabled on every Phase 1 table. Policies are intentionally deferred until
the authenticated membership and RBAC model is added in later phases, so no
table is accidentally exposed through the client before authorization rules
exist. Phase 22 will add append-only audit events for actor, school, action,
entity and change metadata. Database timestamps and soft-delete fields provide
the interim lifecycle history needed by the foundation.

Files such as avatars, documents and certificates are represented by storage
paths (`avatar_path`, `photo_path`, `logo_path`) rather than binary data in
relational tables. Supabase Storage policies will be added when those modules
are implemented.# Phase 1 database foundation

The migration in `supabase/migrations/20260911000100_initial_database_foundation.sql`
creates the first normalized Schooliva schema. It deliberately stops before
attendance, fees, exams, library and other future domains.

## Entity relationships

- Supabase Auth owns credentials in `auth.users`. `profiles` extends an Auth
  user with application-level identity data and is deleted with that user.
- `schools` is the tenant boundary. School-owned records carry `school_id`.
- `roles` may be global templates (`school_id` is null) or school-specific.
  `permissions` are global capabilities, and `role_permissions` maps them to
  roles. `user_roles` assigns a role to a user inside a school.
- A school has one `school_settings` row and can have many academic sessions.
  Each session can have many academic terms.
- `classes` belong to a school. Each class has many `sections`; `subjects`
  belong to a school; `class_subjects` maps subjects to classes.
- `students`, `parents`, `teachers` and `staff` are school-owned people
  records. Optional `profile_id` links a person to a Supabase Auth profile when
  that person needs an account.
- `student_parents` is the many-to-many relationship between students and
  parents, with one optional primary parent per student.
- `student_enrollments` places one student into one class and section for an
  academic session. A student can have only one enrollment per session.

## Integrity and tenancy

School-scoped foreign keys use `(school_id, id)` composite references where
relationships cross entities. This prevents accidentally linking records from
different schools even if a caller supplies valid UUIDs. Unique constraints are
scoped by school for codes, names and memberships.

## Lifecycle and auditability

Operational entities have UTC `created_at` and `updated_at` timestamps. Update
triggers keep `updated_at` current. Student, parent, teacher and staff records
also have `deleted_at` and `is_active` so records can be hidden without losing
historical relationships. Future audit logs will capture actor, action,
entity, entity ID and before/after data in a dedicated append-only module.

Uploaded images and documents are represented by path columns such as
`logo_path`, `photo_path` and `avatar_path`; binary content belongs in Supabase
Storage, not PostgreSQL rows.

## Row Level Security

RLS is enabled on every Phase 1 table. Policies are intentionally deferred to
the authentication and RBAC phases, where they can use the authenticated user,
school membership and role model together. Until those policies exist, access
should be performed only through trusted migration or server-side tooling.