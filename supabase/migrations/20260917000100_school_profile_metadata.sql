alter table public.schools
  add column if not exists short_name text,
  add column if not exists campus text,
  add column if not exists school_type text,
  add column if not exists board text,
  add column if not exists medium text,
  add column if not exists principal text,
  add column if not exists established_year integer;

alter table public.school_settings
  add column if not exists academic_year text;

drop function if exists public.bootstrap_school(text, text, text, text, text, text, text);

create or replace function public.bootstrap_school(
  school_name text,
  school_slug text,
  school_code text,
  school_email text default null,
  school_phone text default null,
  school_timezone text default 'UTC',
  school_currency text default 'USD',
  school_short_name text default null,
  school_campus text default null,
  school_type text default null,
  school_board text default null,
  school_medium text default null,
  school_address text default null,
  school_city text default null,
  school_province text default null,
  school_country text default null,
  school_principal text default null,
  school_established_year integer default null,
  school_academic_year text default null,
  school_website text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_school_id uuid;
  admin_role_id uuid;
  default_scale_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if exists (select 1 from public.user_roles where user_id = current_user_id) then
    raise exception 'User already belongs to a school';
  end if;

  insert into public.schools (name, short_name, slug, code, school_type, campus, board, medium, email, phone, website, address, city, state, country, principal, established_year, created_by)
  values (trim(school_name), nullif(trim(school_short_name), ''), lower(trim(school_slug)), upper(trim(school_code)), nullif(trim(school_type), ''), nullif(trim(school_campus), ''), nullif(trim(school_board), ''), nullif(trim(school_medium), ''), nullif(trim(school_email), ''), nullif(trim(school_phone), ''), nullif(trim(school_website), ''), nullif(trim(school_address), ''), nullif(trim(school_city), ''), nullif(trim(school_province), ''), nullif(trim(school_country), ''), nullif(trim(school_principal), ''), school_established_year, current_user_id)
  returning id into new_school_id;

  insert into public.school_settings (school_id, timezone, currency_code, academic_year)
  values (new_school_id, coalesce(nullif(trim(school_timezone), ''), 'UTC'), upper(coalesce(nullif(trim(school_currency), ''), 'USD')), nullif(trim(school_academic_year), ''));

  select id into admin_role_id from public.roles where school_id is null and slug = 'school_admin';
  if admin_role_id is null then
    raise exception 'School Admin role is not configured';
  end if;

  insert into public.user_roles (user_id, school_id, role_id)
  values (current_user_id, new_school_id, admin_role_id);

  insert into public.exam_types (school_id, name)
  select new_school_id, type_name
  from (values ('Monthly Test'), ('Mid Term'), ('Final Term'), ('Quiz'), ('Assignment')) as defaults(type_name);

  insert into public.grading_scales (school_id, name, description)
  values (new_school_id, 'Standard (A-F)', 'Default five-letter grading scale')
  returning id into default_scale_id;

  insert into public.grade_boundaries (grading_scale_id, grade, min_percentage, max_percentage, grade_point, remark)
  values
    (default_scale_id, 'A', 90, 100, 4.00, 'Outstanding'),
    (default_scale_id, 'B', 80, 89.99, 3.00, 'Above average'),
    (default_scale_id, 'C', 70, 79.99, 2.00, 'Average'),
    (default_scale_id, 'D', 60, 69.99, 1.00, 'Below average'),
    (default_scale_id, 'F', 0, 59.99, 0.00, 'Needs improvement');

  return new_school_id;
end;
$$;
