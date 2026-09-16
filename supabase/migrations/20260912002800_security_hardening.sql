revoke all on function public.write_audit_log(uuid, text, text, uuid, jsonb, uuid) from authenticated;
revoke all on function public.write_audit_log(uuid, text, text, uuid, jsonb, uuid) from public;

create policy "Audit log writes require system context"
on public.audit_logs for insert to authenticated
with check (false);

create policy "Audit log updates are forbidden"
on public.audit_logs for update to authenticated
using (false)
with check (false);

create policy "Audit log deletes are forbidden"
on public.audit_logs for delete to authenticated
using (false);
