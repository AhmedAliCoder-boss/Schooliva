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

The migration seeds global system roles for Super Admin, School Admin,
Principal, Teacher, Accountant, HR Manager, Librarian, Transport Manager,
Staff, Parent and Student. Roles can later be copied or customized per school.

## Special access rules

- School data requires a matching `school_id` membership.
- Parents can read only students connected through `student_parents` to their
  own parent profile.
- Students can read only their own student record through `students.profile_id`.
- Teachers and staff require the relevant permission; future assignment tables
  can further narrow their scope without changing the permission model.
- Super Admin is the only platform-wide role and is still subject to explicit
  policy branches rather than frontend assumptions.

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