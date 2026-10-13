# Phase 3 RBAC

## Authorization layers

1. Supabase Auth authenticates the user and supplies `auth.uid()`.
2. `user_roles` assigns that user to a school and role.
3. `role_permissions` maps the role to granular `resource` and `action`
   permissions.
4. Security-definer PostgreSQL functions evaluate membership and permissions
   without creating recursive RLS policy queries.
5. RLS policies enforce the final database boundary. Server utilities and UI
   gates improve the user experience but never replace RLS.

## Default roles

The migration seeds global system roles for Master Admin, Super Admin, School
Admin, Principal, Teacher, Accountant, HR Manager, Librarian, Transport Manager,
Staff, Parent and Student. Roles can later be copied or customized per school.

## Special access rules

- School data requires a matching `school_id` membership.
- Parents can read only students connected through `student_parents` to their
  own parent profile.
- Students can read only their own student record through `students.profile_id`.
- Teachers and staff require the relevant permission; future assignment tables
  can further narrow their scope without changing the permission model.
- Master Admin and the legacy Super Admin role are platform-wide and are
  recognized by the same database authorization helpers.
- Only platform admins can list every account or move accounts between schools.
  School account managers can manage memberships in their active school but
  cannot modify a platform admin or an account shared across schools.
- Application User IDs and usernames are unique, case-insensitive login
  identifiers. The Supabase Auth UUID remains immutable and is used only as
  the internal account key.
- Account status (`active`, `inactive`, or `suspended`) is enforced during
  sign-in and by protected application/database access. It stays synchronized
  with the legacy `profiles.is_active` flag.
- Finance pages require the school-scoped `fees` view/manage permission.
  School expenses use the narrower `finance` view/manage permission so a
  learner or parent with fee visibility cannot see internal spending records.
- Payroll compensation and runs use a separate school-scoped `payroll`
  permission. Default School Admin, Principal, Accountant, and HR Manager roles
  can manage payroll; salary records are not exposed through general staff or
  finance views. Attendance and deduction policy changes require the additional
  `payroll_policy:manage` permission, seeded only for School Admin and
  Principal roles (with platform-admin access retained).
- Recruitment uses the school-scoped `recruitment:view` and `recruitment:manage`
  permissions for vacancies, candidates, and interviews. School Admin, Principal,
  HR Manager, and platform admins receive full module access by default.

## Account administration

Master Admins use `/admin/accounts` to search and filter accounts, inspect
Auth/profile details and audit history, update email/password/status, and
assign or move school memberships. School account managers use `/users` to
manage accounts in their selected school only. Both routes use the
`can_manage_account` database function in addition to server-side checks; do
not replace those checks with UI-only role filtering.

School Admins can directly create only lower-level accounts (Teacher, Staff,
Accountant, HR Manager, Librarian, or Transport Manager) for their selected
school. The server action and `create_managed_account` RPC both enforce that
scope; School Admin and Principal accounts are provisioned by a Master Admin.
Hiring through HRM creates an employee record without a login. A same-school
Principal or School Admin can request an employee login from the profile;
Master Admins review requests at `/admin/accounts/requests` and approve by
sending a Supabase Auth invitation or reject the request. Approval links the
profile, school role, employee record, and employee ID atomically.

Employee verification files are uploaded one at a time to the private
`employee-verification` bucket, with per-school HRM permission checks on both
Storage and document metadata. Each document remains pending until an authorized
HRM manager marks it verified or requests a replacement.

## Application utilities

`src/lib/auth/authorization.ts` provides `hasPermission`,
`requirePermission`, `getCurrentUser` and `requireUser`. Server components and
server actions should use these helpers for route decisions. The
`PermissionGate` component provides a server-rendered UI check, while database
RLS remains authoritative.

## Testing

Anonymous REST requests to tenant tables return empty result sets. Authenticated
role-specific tests should use test users assigned to separate schools and
verify both allowed and denied reads/writes directly against Supabase. Never
use a service-role key for browser or user-session tests.