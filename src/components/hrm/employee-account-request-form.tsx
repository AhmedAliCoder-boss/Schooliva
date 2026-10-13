"use client";

import { useActionState } from "react";

import { requestHrmEmployeeAccount } from "@/app/actions/hrm";
import { SubmitButton } from "@/components/auth/submit-button";
import type { HrmFormState } from "@/lib/hrm/schemas";

type RoleOption = { id: string; name: string; slug: string };

export function EmployeeAccountRequestForm({
  employeeId,
  employeeType,
  email,
  roles,
  pendingRequest,
}: {
  employeeId: string;
  employeeType: "teacher" | "staff";
  email: string;
  roles: RoleOption[];
  pendingRequest: boolean;
}) {
  const [state, action] = useActionState(requestHrmEmployeeAccount, undefined);

  return <section className="student-panel hrm-account-request">
    <div className="student-panel-heading"><h2>Employee login account</h2><span>Master Admin approval</span></div>
    {pendingRequest
      ? <p className="student-muted">An account request for this employee is awaiting Master Admin review.</p>
      : roles.length
        ? <form action={action} className="hrm-account-request-form">
            <input type="hidden" name="employeeId" value={employeeId} />
            <input type="hidden" name="employeeType" value={employeeType} />
            <p>Send a request to the Master Admin to create this employee’s Schooliva login.</p>
            <label>Login email<input name="email" type="email" maxLength={254} defaultValue={email} required /></label>
            <label>Login username<input name="username" minLength={3} maxLength={30} pattern="[A-Za-z0-9._-]+" required /></label>
            <label>School role<select name="roleId" defaultValue={roles.find((role) => role.slug === employeeType)?.id ?? roles[0].id} required>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select></label>
            <p className="hrm-account-request-note">The Master Admin reviews and provisions the account. Its User ID will match the employee ID.</p>
            {state?.error && <p className="student-error" role="alert">{state.error}</p>}
            {state?.success && <p className="student-success" role="status">{state.success}</p>}
            <SubmitButton>Request account</SubmitButton>
          </form>
        : <p className="student-muted">No permitted employee roles are configured for this school.</p>}
  </section>;
}
