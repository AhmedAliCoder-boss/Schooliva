"use client";

import { useState } from "react";

import {
  changeManagedAccountEmail,
  changeManagedAccountStatus,
  moveManagedAccountSchool,
  sendManagedAccountPasswordReset,
  setManagedAccountPassword,
  updateManagedAccount,
  uploadManagedAccountPhoto,
} from "@/app/actions/account-management";
import { AccountActionForm } from "@/components/admin/account-action-form";

type Option = { id: string; name: string; school_id?: string | null; slug?: string };
type Membership = { school_id: string; school_name: string; role_id: string; role_name: string; role_slug: string };

export function AccountDetailActions({
  userId,
  fullName,
  applicationUserId,
  username,
  firstName,
  lastName,
  phone,
  email,
  status,
  memberships,
  schools,
  roles,
  isProtected,
  isMasterAdmin,
}: {
  userId: string;
  fullName: string;
  applicationUserId: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  status: "active" | "inactive" | "suspended";
  memberships: Membership[];
  schools: Option[];
  roles: Option[];
  isProtected: boolean;
  isMasterAdmin: boolean;
}) {
  const [membership, setMembership] = useState<Membership | null>(memberships[0] ?? null);
  const [destinationSchool, setDestinationSchool] = useState("");
  const selectedRoles = roles.filter((role) =>
    (role.school_id == null || role.school_id === membership?.school_id)
    && role.slug !== "super_admin"
    && role.slug !== "master_admin"
  );
  const destinationRoles = roles.filter((role) =>
    (role.school_id == null || role.school_id === destinationSchool)
    && role.slug !== "super_admin"
    && role.slug !== "master_admin"
  );
  const selectedSchoolId = membership?.school_id ?? "";

  return (
    <div className="account-detail-actions">
      <section id="profile" className="admin-panel account-editor-panel">
        <header className="admin-panel__heading"><div><p className="admin-kicker">Profile</p><h2>Edit account details</h2></div></header>
        {isProtected
          ? <p className="admin-note">Platform administrator accounts are protected from profile, role, status, and password changes in this flow.</p>
          : memberships.length
            ? <>
              {memberships.length > 1 && <label className="account-context-select">School membership<select value={membership?.school_id ?? ""} onChange={(event) => setMembership(memberships.find((row) => row.school_id === event.target.value) ?? null)}>{memberships.map((row) => <option key={`${row.school_id}-${row.role_id}`} value={row.school_id}>{row.school_name} · {row.role_name}</option>)}</select></label>}
              {membership && <AccountActionForm
                action={updateManagedAccount}
                className="account-edit-form"
                submitLabel="Save changes"
                pendingLabel="Saving..."
                confirmMessage="Save these account and role changes? The new role’s permissions take effect immediately."
              >
                <input type="hidden" name="userId" value={userId} />
                <input type="hidden" name="schoolId" value={membership.school_id} />
                <div className="account-form-grid">
                  <label>First name<input name="firstName" defaultValue={firstName} maxLength={80} required /></label>
                  <label>Last name<input name="lastName" defaultValue={lastName} maxLength={80} /></label>
                  <label className="account-form-wide">Full name<input name="fullName" defaultValue={fullName} minLength={2} maxLength={120} required /></label>
                  <label>Application User ID<input name="applicationUserId" defaultValue={applicationUserId} minLength={3} maxLength={40} pattern="[A-Za-z0-9._-]+" required /></label>
                  <label>Username / login ID<input name="username" defaultValue={username} minLength={3} maxLength={30} pattern="[A-Za-z0-9._-]+" required /></label>
                  <label>Phone<input name="phone" defaultValue={phone} maxLength={40} /></label>
                  <label>School role<select name="roleId" defaultValue={membership.role_id} required>{selectedRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
                </div>
              </AccountActionForm>}
            </>
            : <p className="admin-note">This account has no school membership yet. Assign it to a school below before editing a school role.</p>}
      </section>

      <section id="email" className="admin-panel account-editor-panel">
        <header className="admin-panel__heading"><div><p className="admin-kicker">Email</p><h2>Supabase Auth email</h2></div></header>
        {isProtected
          ? <p className="admin-note">Platform administrator email changes are not available from this account page.</p>
          : <AccountActionForm action={changeManagedAccountEmail} className="account-edit-form" submitLabel="Request email change" pendingLabel="Requesting..." confirmMessage={`Request an email change for ${fullName}? Supabase may require the user to confirm the new address.`}>
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="schoolId" value={selectedSchoolId} />
              <label>Email address<input name="email" type="email" defaultValue={email} maxLength={254} required /></label>
            </AccountActionForm>}
      </section>

      <section id="security" className="admin-panel account-editor-panel">
        <header className="admin-panel__heading"><div><p className="admin-kicker">Security</p><h2>Password and account status</h2></div></header>
        {isProtected
          ? <p className="admin-note">Platform administrator accounts are protected from password and status changes in this flow.</p>
          : <div className="account-security-grid">
              <AccountActionForm action={setManagedAccountPassword} className="account-edit-form" submitLabel="Change password" pendingLabel="Changing..." confirmMessage={`Change the Supabase Auth password for ${fullName}?`}>
                <input type="hidden" name="userId" value={userId} />
                <input type="hidden" name="schoolId" value={selectedSchoolId} />
                <label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
                <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
              </AccountActionForm>
              <AccountActionForm action={sendManagedAccountPasswordReset} className="account-edit-form" submitLabel="Send reset email" pendingLabel="Sending..." confirmMessage={`Send a Supabase Auth password reset email for ${fullName}?`}>
                <input type="hidden" name="userId" value={userId} />
                <input type="hidden" name="schoolId" value={selectedSchoolId} />
                <p className="account-form-note">A secure reset link is sent to the current Auth email. No temporary password is displayed.</p>
              </AccountActionForm>
              <AccountActionForm action={changeManagedAccountStatus} className="account-edit-form" submitLabel="Save account status" pendingLabel="Updating..." confirmMessage={`Change the account status for ${fullName}? This affects both Supabase Auth sign-in and Schooliva access.`}>
                <input type="hidden" name="userId" value={userId} />
                <input type="hidden" name="schoolId" value={selectedSchoolId} />
                <label>Account status<select name="status" defaultValue={status}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></label>
              </AccountActionForm>
            </div>}
      </section>

      {isMasterAdmin && <section id="school-membership" className="admin-panel account-editor-panel">
        <header className="admin-panel__heading"><div><p className="admin-kicker">School membership</p><h2>Assign or move schools</h2></div></header>
        {isProtected
          ? <p className="admin-note">Platform administrator school assignments are protected.</p>
          : <div className="account-membership-moves">
              {(memberships.length ? memberships : [null]).map((source) => (
                <MoveMembershipForm
                  key={source ? `${source.school_id}-${source.role_id}` : "unassigned"}
                  userId={userId}
                  source={source}
                  schools={schools}
                  roles={roles}
                  destinationSchool={destinationSchool}
                  setDestinationSchool={setDestinationSchool}
                  destinationRoles={destinationRoles}
                />
              ))}
            </div>}
      </section>}

      <section id="photo" className="admin-panel account-editor-panel">
        <header className="admin-panel__heading"><div><p className="admin-kicker">Profile picture</p><h2>Photo</h2></div></header>
        <AccountActionForm action={uploadManagedAccountPhoto} className="account-edit-form" submitLabel="Upload photo" pendingLabel="Uploading...">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="schoolId" value={selectedSchoolId} />
          <label>JPEG, PNG, or WebP (max 5 MB)<input name="profilePhoto" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
        </AccountActionForm>
      </section>
    </div>
  );
}

function MoveMembershipForm({
  userId,
  source,
  schools,
  roles,
  destinationSchool,
  setDestinationSchool,
  destinationRoles,
}: {
  userId: string;
  source: Membership | null;
  schools: Option[];
  roles: Option[];
  destinationSchool: string;
  setDestinationSchool: (value: string) => void;
  destinationRoles: Option[];
}) {
  const availableSchools = schools.filter((school) => school.id !== source?.school_id);
  const roleOptions = destinationRoles.length
    ? destinationRoles
    : roles.filter((role) => role.school_id == null && role.slug !== "super_admin" && role.slug !== "master_admin");

  return (
    <AccountActionForm
      action={moveManagedAccountSchool}
      className="account-edit-form account-membership-move"
      submitLabel={source ? "Move membership" : "Assign school"}
      pendingLabel="Moving..."
      confirmMessage={source
        ? `Move this membership from ${source.school_name} to the selected destination? Historical records remain in the original school.`
        : "Assign this account to the selected school?"}
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="sourceSchoolId" value={source?.school_id ?? ""} />
      <label>Current school<input value={source?.school_name ?? "Unassigned"} readOnly /></label>
      <label>Destination school<select name="destinationSchoolId" value={destinationSchool} onChange={(event) => setDestinationSchool(event.target.value)} required><option value="" disabled>Select a school</option>{availableSchools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
      <label>Destination role<select name="roleId" defaultValue="" required><option value="" disabled>Select a role</option>{roleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
    </AccountActionForm>
  );
}
