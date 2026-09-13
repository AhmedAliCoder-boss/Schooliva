-- Phase 11: seed default exam types and a default grading scale.
-- New schools get defaults through bootstrap_school; existing schools are backfilled below.

create extension if not exists pgcrypto;

create or replace function public.bootstrap_school(
  school_name text,
  school_slug text,
  school_code text,
  school_email text default null,
  school_phone text default null,
  school_timezone text default 'UTC',
  school_currency text default 'USD'
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

  insert into public.schools (name, slug, code, email, phone, created_by)
  values (trim(school_name), lower(trim(school_slug)), upper(trim(school_code)), school_email, school_phone, current_user_id)
  returning id into new_school_id;

  insert into public.school_settings (school_id, timezone, currency_code)
  values (new_school_id, coalesce(nullif(trim(school_timezone), ''), 'UTC'), upper(coalesce(nullif(trim(school_currency), ''), 'USD')));

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

do $$
declare
  school_record record;
  default_scale_id uuid;
begin
  for school_record in select id from public.schools loop
    if not exists (select 1 from public.exam_types where school_id = school_record.id) then
      insert into public.exam_types (school_id, name)
      select school_record.id, type_name
      from (values ('Monthly Test'), ('Mid Term'), ('Final Term'), ('Quiz'), ('Assignment')) as defaults(type_name);
    end if;

    if not exists (select 1 from public.grading_scales where school_id = school_record.id) then
      insert into public.grading_scales (school_id, name, description)
      values (school_record.id, 'Standard (A-F)', 'Default five-letter grading scale')
      returning id into default_scale_id;

      insert into public.grade_boundaries (grading_scale_id, grade, min_percentage, max_percentage, grade_point, remark)
      values
        (default_scale_id, 'A', 90, 100, 4.00, 'Outstanding'),
        (default_scale_id, 'B', 80, 89.99, 3.00, 'Above average'),
        (default_scale_id, 'C', 70, 79.99, 2.00, 'Average'),
        (default_scale_id, 'D', 60, 69.99, 1.00, 'Below average'),
        (default_scale_id, 'F', 0, 59.99, 0.00, 'Needs improvement');
    end if;
  end loop;
end $$;