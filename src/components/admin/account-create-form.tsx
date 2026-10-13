"use client";

import { useState } from "react";

import { createManagedAccount } from "@/app/actions/account-management";
import { AccountActionForm } from "@/components/admin/account-action-form";

type SelectOption = { id: string; name: string; school_id?: string | null; slug?: string };

export function AccountCreateForm({
  schools,
  roles,
  defaultSchoolId,
  schoolLocked = false,
}: {
  schools: SelectOption[];
  roles: SelectOption[];
  defaultSchoolId?: string;
  schoolLocked?: boolean;
}) {
  const [schoolId, setSchoolId] = useState(defaultSchoolId ?? "");
  const selectableRoles = roles.filter((role) =>
    (role.school_id == null || role.school_id === schoolId)
    && role.slug !== "super_admin"
    && role.slug !== "master_admin"
  );

  return (
    <AccountActionForm
      action={createManagedAccount}
      className="account-edit-form"
      submitLabel="Create user"
      pendingLabel="Creating account..."
    >
      <fieldset className="account-create-section">
        <legend>Personal information</legend>
        <p>Enter the name and contact details that will appear across the school workspace.</p>
        <div className="account-form-grid">
          <label>First name<input name="firstName" autoComplete="given-name" maxLength={80} required /></label>
          <label>Last name<input name="lastName" autoComplete="family-name" maxLength={80} /></label>
          <label className="account-form-wide">Full name<input name="fullName" autoComplete="name" minLength={2} maxLength={120} required /></label>
          <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
          <label>Phone number <span className="account-optional-label">Optional</span><input name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
          <label>Profile photo <span className="account-optional-label">Optional · JPG, PNG, WebP</span><input name="profilePhoto" type="file" accept="image/png,image/jpeg,image/webp" /></label>
        </div>
      </fieldset>
      <fieldset className="account-create-section">
        <legend>Login and access</legend>
        <p>Set unique login identifiers, school assignment, and the least-privilege role needed.</p>
        <div className="account-form-grid">
          <label>Application User ID<input name="applicationUserId" minLength={3} maxLength={40} pattern="[A-Za-z0-9._-]+" required /><span className="account-field-hint">Unique account reference; letters, numbers, dot, dash, underscore.</span></label>
          <label>Username / login ID<input name="username" autoComplete="username" minLength={3} maxLength={30} pattern="[A-Za-z0-9._-]+" required /><span className="account-field-hint">The user can sign in with this username or their email.</span></label>
          {schoolLocked
            ? <label>School<input value={schools.find((school) => school.id === schoolId)?.name ?? ""} readOnly /><input type="hidden" name="schoolId" value={schoolId} /></label>
            : <label>School<select name="schoolId" value={schoolId} onChange={(event) => setSchoolId(event.target.value)} required><option value="" disabled>Select a school</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>}
          <label>School role<select name="roleId" defaultValue="" required><option value="" disabled>Select a role</option>{selectableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
          <label>Initial status<select name="status" defaultValue="active"><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></label>
        </div>
      </fieldset>
      <fieldset className="account-create-section">
        <legend>Temporary password</legend>
        <p>Use at least 12 characters, including a letter, number, and symbol.</p>
        <div className="account-form-grid">
          <label>Password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
          <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
        </div>
      </fieldset>
      <p className="account-form-note">Supabase Auth creates the permanent internal UUID and sends the account invitation. Passwords are never stored in Schooliva profile or audit data.</p>
    </AccountActionForm>
  );
}
