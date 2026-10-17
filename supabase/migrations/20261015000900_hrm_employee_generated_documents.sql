create table public.hrm_employee_generated_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  employee_type text not null check (employee_type in ('teacher', 'staff')),
  employee_id uuid not null,
  document_type text not null check (
    document_type in ('appointment', 'experience', 'employment_verification', 'promotion', 'relieving')
  ),
  document_number text not null,
  issued_on date not null,
  content jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  unique (school_id, document_number)
);

create index hrm_employee_generated_documents_history_idx
  on public.hrm_employee_generated_documents (school_id, created_at desc);
create index hrm_employee_generated_documents_employee_idx
  on public.hrm_employee_generated_documents (school_id, employee_type, employee_id, created_at desc);

alter table public.hrm_employee_generated_documents enable row level security;
grant select, insert on table public.hrm_employee_generated_documents to authenticated;

create policy "HRM users can view generated employee documents"
on public.hrm_employee_generated_documents for select to authenticated
using (
  public.has_permission(school_id, 'recruitment', 'view')
  or public.has_permission(school_id, 'recruitment', 'manage')
  or public.is_super_admin()
);

create policy "HRM managers can issue employee documents"
on public.hrm_employee_generated_documents for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_permission(school_id, 'recruitment', 'manage')
  and (
    (employee_type = 'teacher' and exists (
      select 1 from public.teachers
      where id = employee_id and school_id = hrm_employee_generated_documents.school_id
    ))
    or (employee_type = 'staff' and exists (
      select 1 from public.staff
      where id = employee_id and school_id = hrm_employee_generated_documents.school_id
    ))
  )
);
