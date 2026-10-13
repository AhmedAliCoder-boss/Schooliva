alter table public.hrm_employee_documents
  add column if not exists status text not null default 'pending',
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hrm_employee_documents'::regclass
      and conname = 'hrm_employee_documents_status_check'
  ) then
    alter table public.hrm_employee_documents
      add constraint hrm_employee_documents_status_check
      check (status in ('pending', 'verified', 'rejected'));
  end if;
end;
$$;

grant insert on table public.hrm_employee_documents to authenticated;

drop policy if exists "HRM managers can add employee verification records"
  on public.hrm_employee_documents;
create policy "HRM managers can add employee verification records"
on public.hrm_employee_documents for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and public.has_permission(school_id, 'recruitment', 'manage')
  and storage_path like school_id::text || '/' || employee_type || '/' || employee_id::text || '/%'
  and (
    (employee_type = 'teacher' and exists (
      select 1 from public.teachers
      where id = employee_id and school_id = hrm_employee_documents.school_id
    ))
    or (employee_type = 'staff' and exists (
      select 1 from public.staff
      where id = employee_id and school_id = hrm_employee_documents.school_id
    ))
  )
);

drop policy if exists "HRM managers can upload employee verification files"
  on storage.objects;
create policy "HRM managers can upload employee verification files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'employee-verification'
  and public.has_permission(split_part(name, '/', 1)::uuid, 'recruitment', 'manage')
  and split_part(name, '/', 2) in ('teacher', 'staff')
  and split_part(name, '/', 4) <> ''
  and (
    (split_part(name, '/', 2) = 'teacher' and exists (
      select 1 from public.teachers
       where id::text = split_part(name, '/', 3)
         and school_id::text = split_part(name, '/', 1)
    ))
    or (split_part(name, '/', 2) = 'staff' and exists (
      select 1 from public.staff
       where id::text = split_part(name, '/', 3)
         and school_id::text = split_part(name, '/', 1)
    ))
  )
);

drop policy if exists "HRM managers can delete employee verification files"
  on storage.objects;
create policy "HRM managers can delete employee verification files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'employee-verification'
  and split_part(name, '/', 2) in ('teacher', 'staff')
  and public.has_permission(split_part(name, '/', 1)::uuid, 'recruitment', 'manage')
  and (
    (split_part(name, '/', 2) = 'teacher' and exists (
      select 1 from public.teachers
       where id::text = split_part(name, '/', 3)
         and school_id::text = split_part(name, '/', 1)
    ))
    or (split_part(name, '/', 2) = 'staff' and exists (
      select 1 from public.staff
       where id::text = split_part(name, '/', 3)
         and school_id::text = split_part(name, '/', 1)
    ))
  )
);

create or replace function public.review_hrm_employee_document(
  p_document_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
begin
  if auth.uid() is null
     or not public.is_account_active()
     or p_status is null
     or p_status not in ('pending', 'verified', 'rejected') then
    raise exception 'A valid active user and document status are required.';
  end if;

  select school_id into v_school_id
    from public.hrm_employee_documents
   where id = p_document_id;
  if not found or not public.has_permission(v_school_id, 'recruitment', 'manage') then
    raise exception 'You do not have permission to review this employee document.';
  end if;

  update public.hrm_employee_documents
     set status = p_status,
         reviewed_by = auth.uid(),
         reviewed_at = timezone('utc', now())
   where id = p_document_id
     and school_id = v_school_id;
end;
$$;

revoke all on function public.review_hrm_employee_document(uuid, text) from public, anon;
grant execute on function public.review_hrm_employee_document(uuid, text) to authenticated;
