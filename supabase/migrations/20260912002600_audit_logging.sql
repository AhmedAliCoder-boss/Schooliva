create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  check (length(trim(action)) > 0),
  check (length(trim(entity_type)) > 0)
);

create index audit_logs_school_created_idx on public.audit_logs (school_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (school_id, entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (school_id, actor_id, created_at desc);

alter table public.audit_logs enable row level security;

insert into public.permissions (resource, action, description)
values ('audit_logs', 'view', 'View school audit logs'), ('audit_logs', 'manage', 'Manage audit configuration')
on conflict (resource, action) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.resource = 'audit_logs'
where r.school_id is null and r.slug in ('super_admin', 'school_admin', 'principal')
  and p.action = 'view'
on conflict do nothing;

create policy "Administrators can read audit logs"
on public.audit_logs for select to authenticated
using (public.has_permission(school_id, 'audit_logs', 'view') or public.is_super_admin());

create or replace function public.write_audit_log(
  target_school_id uuid,
  target_action text,
  target_entity_type text,
  target_entity_id uuid default null,
  target_metadata jsonb default '{}'::jsonb,
  target_actor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare audit_id uuid;
begin
  insert into public.audit_logs (school_id, actor_id, action, entity_type, entity_id, metadata)
  values (target_school_id, coalesce(target_actor_id, (select auth.uid())), target_action, target_entity_type, target_entity_id, coalesce(target_metadata, '{}'::jsonb))
  returning id into audit_id;
  return audit_id;
end;
$$;

revoke all on function public.write_audit_log(uuid, text, text, uuid, jsonb, uuid) from public;
grant execute on function public.write_audit_log(uuid, text, text, uuid, jsonb, uuid) to authenticated;

create or replace function public.prevent_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Audit logs are append-only';
end;
$$;

create trigger audit_logs_prevent_update
before update or delete on public.audit_logs
for each row execute function public.prevent_audit_mutation();

create or replace function public.audit_finance_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.write_audit_log(
    coalesce(new.school_id, old.school_id),
    lower(tg_op),
    tg_table_name,
    coalesce(new.id, old.id),
    jsonb_build_object('new', to_jsonb(new), 'old', to_jsonb(old))
  );
  return coalesce(new, old);
end;
$$;

create trigger fee_invoices_audit_log after insert or update or delete on public.fee_invoices for each row execute function public.audit_finance_change();
create trigger fee_payments_audit_log after insert or update or delete on public.fee_payments for each row execute function public.audit_finance_change();
create trigger fee_invoice_items_audit_log after insert or update or delete on public.fee_invoice_items for each row execute function public.audit_finance_change();
create trigger marks_audit_log after insert or update or delete on public.marks for each row execute function public.audit_finance_change();
create trigger attendance_audit_log after insert or update or delete on public.student_attendance for each row execute function public.audit_finance_change();
create trigger audit_user_roles_change after insert or update or delete on public.user_roles for each row execute function public.audit_finance_change();
create trigger audit_certificate_change after insert or update or delete on public.certificate_records for each row execute function public.audit_finance_change();
