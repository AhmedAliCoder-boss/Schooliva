alter table public.admissions
  add column if not exists guardian_relationship text not null default 'guardian';

alter table public.students
  add column if not exists emergency_contact_relationship text;
