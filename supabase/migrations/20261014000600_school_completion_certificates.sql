alter table public.certificate_records
  drop constraint if exists certificate_records_certificate_type_check;

alter table public.certificate_records
  add constraint certificate_records_certificate_type_check
  check (certificate_type in ('character', 'bonafide', 'leaving', 'enrollment', 'completion'));

create or replace function public.review_student_certificate(
  target_certificate_id uuid,
  target_decision text,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  certificate public.certificate_records%rowtype;
  student public.students%rowtype;
begin
  if auth.uid() is null or not public.is_account_active() then
    raise exception 'An active signed-in account is required to review certificates.';
  end if;

  if target_decision is null or target_decision not in ('approve', 'reject')
    or length(coalesce(target_notes, '')) > 1000 then
    raise exception 'Certificate review decision is invalid.';
  end if;

  select cr.*
    into certificate
    from public.certificate_records cr
   where cr.id = target_certificate_id
   for update;
  if not found then
    raise exception 'Certificate request was not found.';
  end if;

  if not exists (
    select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
     where ur.user_id = auth.uid()
       and ur.school_id = certificate.school_id
       and (r.school_id = certificate.school_id or r.school_id is null)
       and r.slug in ('school_admin', 'principal')
  ) then
    raise exception 'Only a School Admin or Principal can review this certificate.';
  end if;

  if certificate.status <> 'pending_approval'
    or certificate.certificate_type not in ('character', 'leaving', 'completion') then
    raise exception 'This certificate is not awaiting approval.';
  end if;

  if target_decision = 'approve' then
    select s.*
      into student
      from public.students s
     where s.id = certificate.student_id
       and s.school_id = certificate.school_id
     for update;
    if not found or student.status = 'archived' or not student.is_active then
      raise exception 'The student is already archived or unavailable.';
    end if;

    update public.students
       set status = 'archived',
           is_active = false,
           deleted_at = coalesce(deleted_at, timezone('utc', now()))
     where id = certificate.student_id
       and school_id = certificate.school_id;

    update public.student_enrollments
       set status = 'withdrawn',
           withdrawn_at = coalesce(withdrawn_at, timezone('utc', now())),
           updated_at = timezone('utc', now())
     where student_id = certificate.student_id
       and school_id = certificate.school_id
       and status = 'active';

    update public.certificate_records
       set status = 'issued',
           reviewed_by = auth.uid(),
           reviewed_at = timezone('utc', now()),
           approval_notes = nullif(trim(coalesce(target_notes, '')), '')
     where id = certificate.id;
  else
    update public.certificate_records
       set status = 'rejected',
           reviewed_by = auth.uid(),
           reviewed_at = timezone('utc', now()),
           approval_notes = nullif(trim(coalesce(target_notes, '')), '')
     where id = certificate.id;
  end if;

  return certificate.id;
end;
$$;

revoke all on function public.review_student_certificate(uuid, text, text) from public, anon;
grant execute on function public.review_student_certificate(uuid, text, text) to authenticated;
