# Backup and recovery

## Responsibility

Supabase manages the platform infrastructure, but Schooliva owns recovery decisions. Assign one primary and one backup operator before go-live. Free-tier projects may have limited backup retention and no guaranteed point-in-time recovery, so verify the current Supabase plan.

## Before release

- Export the migration history from Git and keep it in the release artifact.
- Record the Supabase project reference and region.
- Confirm database backups are enabled in the Supabase dashboard.
- Export a schema-only backup for the release.
- Keep production data out of local development and test fixtures.
- Record Storage bucket names and retention expectations.

## Recovery procedure

1. Freeze write workflows and announce the incident.
2. Identify the last known-good migration and backup timestamp.
3. Create a separate recovery project or branch before destructive work.
4. Restore the database backup using the Supabase dashboard or supported CLI workflow.
5. Apply only migrations that are newer than the restored schema:

```powershell
supabase link --project-ref <recovery-project-ref>
supabase db push
```

6. Verify RLS, role membership, storage policies, and Auth configuration.
7. Run unit, integration, database, and E2E smoke tests against recovery.
8. Rotate compromised credentials and update encrypted hosting variables if exposure is suspected.
9. Point the frontend to the recovered project only after the smoke test passes.
10. Document data loss, recovery time, and corrective actions.

## Backup security

- Never commit database dumps containing personal, academic, or financial data.
- Never place service-role keys in frontend variables, mobile assets, logs, or issue reports.
- Treat signed URLs, Auth recovery links, and test passwords as secrets.
- Store exports in encrypted, access-controlled storage with a defined deletion date.

## Recovery acceptance checks

- Authenticated users can sign in and sign out.
- Anonymous requests cannot read tenant tables.
- A user from School A cannot read School B.
- Parent, student, teacher, and accountant boundaries remain enforced.
- Private Storage buckets are not public.
- Invoice totals, payments, attendance, marks, and audit records remain consistent.
- Critical workflows complete without bypassing RLS.
