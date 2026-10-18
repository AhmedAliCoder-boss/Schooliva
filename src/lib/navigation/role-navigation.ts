export const NAVIGATION_PERMISSION_REQUIREMENTS: Record<string, readonly string[]> = {
  "/dashboard": [],
  "/admissions": ["admissions:view", "admissions:manage"],
  "/students": ["students:view", "students:create", "students:update", "students:delete"],
  "/parents": ["parents:view", "parents:create", "parents:update"],
  "/attendance": ["students.attendance:view", "students.attendance:manage"],
  "/timetable": ["timetable:view", "timetable:manage"],
  "/curriculum": ["curriculum:view", "curriculum:manage"],
  "/academic-planning": ["curriculum:view", "curriculum:manage"],
  "/exams": ["exams:view", "exams:manage"],
  "/results": ["results:view", "results:manage"],
  "/assignments": ["assignments:view", "assignments:manage", "assignments:submit", "assignments:review"],
  "/parent": ["students:view"],
  "/certificates": ["documents:view", "documents:manage"],
  "/finance": ["fees:view", "fees:manage", "finance:view", "finance:manage"],
  "/finance/fees": ["fees:view", "fees:manage"],
  "/finance/invoices": ["fees:view", "fees:manage"],
  "/finance/payments": ["fees:view", "fees:manage", "finance:view", "finance:manage"],
  "/finance/expenses": ["finance:view", "finance:manage", "fees:manage"],
  "/hrm": ["recruitment:view", "recruitment:manage"],
  "/hrm/jobs": ["recruitment:view", "recruitment:manage"],
  "/hrm/candidates": ["recruitment:view", "recruitment:manage"],
  "/hrm/interviews": ["recruitment:manage"],
  "/hrm/employees": ["teachers:view", "teachers:manage", "staff:view", "staff:manage"],
  "/documents": ["documents:view", "documents:manage"],
  "/hrm/exits": ["staff:manage", "hrm:manage"],
  "/people-attendance": ["staff:view", "staff:manage", "teachers:view", "teachers:manage"],
  "/leave": ["leave:view", "leave:manage", "leave:approve"],
  "/payroll": ["payroll:view", "payroll:manage"],
  "/staff": ["users:manage", "roles:manage"],
  "/users": ["users:manage"],
  "/library": ["library:view", "library:manage", "library:issue", "library:return"],
  "/transport": ["transport:view", "transport:manage"],
  "/inventory": ["inventory:view", "inventory:manage"],
  "/cafeteria": ["cafeteria:view", "cafeteria:manage"],
  "/notifications": ["notifications:view", "notifications:manage"],
  "/reports": ["reports:view"],
  "/setup": ["school_setup:manage", "school_settings:manage"],
  "/setup/permissions": ["roles:manage"],
  "/audit": ["audit_logs:view"],
  "/profile": [],
};

export function getAuthorizedNavigationHrefs(permissions: readonly string[]): string[] {
  const grantedPermissions = new Set(permissions);

  return Object.entries(NAVIGATION_PERMISSION_REQUIREMENTS)
    .filter(([href, requirements]) =>
      href === "/dashboard" ||
      href === "/profile" ||
      requirements.some((permission) => grantedPermissions.has(permission))
    )
    .map(([href]) => href);
}
