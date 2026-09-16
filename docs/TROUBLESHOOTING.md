# Troubleshooting

## Build fails because Supabase variables are missing

Copy the template and configure all required values:

```powershell
Copy-Item .env.example .env.local
npm run build
```

The server intentionally fails closed when `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing.

## Login or recovery redirects to localhost

Set `NEXT_PUBLIC_SITE_URL` to the exact HTTPS origin in the hosting provider and Supabase Authentication URL settings. Add the callback path required by the Auth flow to Additional Redirect URLs. Do not use a wildcard production redirect.

## Database migration fails

Confirm the CLI is linked to the intended project, inspect the first failed migration, and do not skip migrations:

```powershell
supabase projects list
supabase link --project-ref <project-ref>
supabase db push
```

Resolve the schema or data conflict in a migration, then rerun. Never edit an already-applied production migration in place.

## RLS returns no rows

This is usually expected for an anonymous user, a different school, or a role without the required permission. Verify the session user, `user_roles` membership, school ID, and role permission mapping. Do not fix this by disabling RLS or using a service-role key in the browser.

## Storage upload or download fails

Check the bucket name, private bucket status, object owner, file MIME type, file size, and the object path expected by the policy. Test with a dedicated role account and an expiring signed URL.

## Production errors expose implementation details

Server actions return safe user-facing messages. Inspect server-side logs with secrets and tokens redacted. Do not put database errors, JWTs, request cookies, or Supabase keys in client responses.

## E2E tests fail before authentication

Start the app against a preview or local server, set `E2E_BASE_URL`, and configure a dedicated test account. Use a separate Supabase project for destructive workflow tests.

```powershell
npm run dev
npm run test:e2e
```

## Integration tests report missing fixtures

Copy `tests/.env.test.example` to a local, ignored fixture file and provide separate users for each role and school. The integration suite deliberately fails instead of silently skipping authorization checks.
