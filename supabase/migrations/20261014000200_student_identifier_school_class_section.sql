create or replace function public.build_student_identifier(target_student_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  student_school_id uuid;
  school_code text;
  student_number integer;
  class_grade integer;
  class_code text;
  section_code text;
  class_token text;
  section_token text;
begin
  select s.school_id,
         s.student_number,
         upper(left(regexp_replace(sc.code, '[^A-Za-z0-9]', '', 'g'), 4))
  into student_school_id, student_number, school_code
  from public.students s
  join public.schools sc on sc.id = s.school_id
  where s.id = target_student_id;

  if not found or school_code is null or school_code = '' then
    raise exception using errcode = '23514', message = 'A school code is required to generate the student ID.';
  end if;

  select c.grade_level, c.code, sec.code
  into class_grade, class_code, section_code
  from public.student_enrollments enrollment
  join public.classes c on c.id = enrollment.class_id and c.school_id = enrollment.school_id
  join public.sections sec on sec.id = enrollment.section_id
    and sec.school_id = enrollment.school_id
    and sec.class_id = enrollment.class_id
  where enrollment.school_id = student_school_id
    and enrollment.student_id = target_student_id
    and enrollment.status = 'active'
  order by enrollment.enrolled_on desc, enrollment.created_at desc, enrollment.id desc
  limit 1;

  if found then
    if class_grade is not null then
      class_token := class_grade::text ||
        case
          when class_grade % 100 between 11 and 13 then 'th'
          when class_grade % 10 = 1 then 'st'
          when class_grade % 10 = 2 then 'nd'
          when class_grade % 10 = 3 then 'rd'
          else 'th'
        end;
    else
      class_token := upper(left(regexp_replace(class_code, '[^A-Za-z0-9]', '', 'g'), 5));
    end if;

    section_token := upper(left(regexp_replace(section_code, '[^A-Za-z0-9]', '', 'g'), 1));
    if class_token is null or class_token = '' or section_token is null or section_token = '' then
      raise exception using errcode = '23514', message = 'Class and section codes are required to generate the student ID.';
    end if;

    return school_code || class_token || section_token || lpad(student_number::text, 4, '0');
  end if;

  return school_code || lpad(student_number::text, 4, '0');
end;
$$;

revoke all on function public.build_student_identifier(uuid) from public, anon, authenticated;

create or replace function public.assign_student_admission_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_student_number integer;
  school_code text;
begin
  insert into public.school_student_number_counters (school_id, last_value)
  values (new.school_id, 1)
  on conflict (school_id) do update
    set last_value = public.school_student_number_counters.last_value + 1
  returning last_value into next_student_number;

  if next_student_number > 9999 then
    raise exception using errcode = '23514', message = 'This school has reached the four-digit student ID limit.';
  end if;

  new.student_number := next_student_number;
  select upper(left(regexp_replace(code, '[^A-Za-z0-9]', '', 'g'), 4))
  into school_code
  from public.schools
  where id = new.school_id;

  if school_code is null or school_code = '' then
    raise exception using errcode = '23514', message = 'A school code is required to generate the student ID.';
  end if;

  if new.admission_number is null or length(trim(new.admission_number)) = 0 then
    new.admission_number := 'ADM-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(replace(gen_random_uuid()::text, '-', ''));
  end if;

  new.student_identifier := school_code || lpad(next_student_number::text, 4, '0');
  return new;
end;
$$;

create or replace function public.refresh_student_identifier_for_enrollment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_student_id uuid;
  previous_student_id uuid;
begin
  if tg_op = 'DELETE' then
    target_student_id := old.student_id;
  else
    target_student_id := new.student_id;
    if tg_op = 'UPDATE' and old.student_id is distinct from new.student_id then
      previous_student_id := old.student_id;
    end if;
  end if;

  perform set_config('schooliva.allow_student_identifier_update', 'on', true);
  if exists (select 1 from public.students where id = target_student_id) then
    update public.students
    set student_identifier = public.build_student_identifier(target_student_id)
    where id = target_student_id;
  end if;
  if previous_student_id is not null
    and exists (select 1 from public.students where id = previous_student_id) then
    update public.students
    set student_identifier = public.build_student_identifier(previous_student_id)
    where id = previous_student_id;
  end if;
  perform set_config('schooliva.allow_student_identifier_update', 'off', true);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

select set_config('schooliva.allow_student_identifier_update', 'on', true);
update public.students student
set student_identifier = public.build_student_identifier(student.id);
select set_config('schooliva.allow_student_identifier_update', 'off', true);
