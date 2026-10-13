alter table public.students
  add column if not exists student_number integer;

with numbered_students as (
  select id, row_number() over (partition by school_id order by created_at, id) as student_number
  from public.students
  where student_number is null
)
update public.students as students
set student_number = numbered_students.student_number
from numbered_students
where students.id = numbered_students.id;

alter table public.students
  alter column student_number set not null;

alter table public.students
  add constraint students_student_number_range
  check (student_number between 1 and 9999);

create unique index if not exists students_school_student_number_key
  on public.students (school_id, student_number);

create table if not exists public.school_student_number_counters (
  school_id uuid primary key references public.schools (id) on delete cascade,
  last_value integer not null check (last_value >= 0)
);

insert into public.school_student_number_counters (school_id, last_value)
select school_id, max(student_number)
from public.students
group by school_id
on conflict (school_id) do update
set last_value = greatest(public.school_student_number_counters.last_value, excluded.last_value);

alter table public.school_student_number_counters enable row level security;

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

drop trigger if exists students_assign_admission_number on public.students;
create trigger students_assign_admission_number
before insert on public.students
for each row execute function public.assign_student_admission_number();

create or replace function public.refresh_student_identifier_for_enrollment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_student_id uuid;
  student_school_id uuid;
  student_number integer;
  school_code text;
  class_token text;
  section_token text;
  class_grade integer;
  class_code text;
  section_code text;
begin
  if tg_op = 'DELETE' then
    target_student_id := old.student_id;
  else
    target_student_id := new.student_id;
  end if;

  select s.school_id, s.student_number,
         upper(left(regexp_replace(sc.code, '[^A-Za-z0-9]', '', 'g'), 4))
  into student_school_id, student_number, school_code
  from public.students s
  join public.schools sc on sc.id = s.school_id
  where s.id = target_student_id;

  if not found then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select c.grade_level, c.code, sec.code
  into class_grade, class_code, section_code
  from public.student_enrollments enrollment
  join public.classes c on c.id = enrollment.class_id and c.school_id = enrollment.school_id
  join public.sections sec on sec.id = enrollment.section_id and sec.school_id = enrollment.school_id and sec.class_id = enrollment.class_id
  where enrollment.school_id = student_school_id
    and enrollment.student_id = target_student_id
    and enrollment.status = 'active'
  order by enrollment.enrolled_on desc, enrollment.created_at desc, enrollment.id desc
  limit 1;

  if found then
    if class_grade is not null then
      class_token := class_grade::text ||
        case
          when class_grade % 100 between 11 and 13 then 'TH'
          when class_grade % 10 = 1 then 'ST'
          when class_grade % 10 = 2 then 'ND'
          when class_grade % 10 = 3 then 'RD'
          else 'TH'
        end;
    else
      class_token := upper(left(regexp_replace(class_code, '[^A-Za-z0-9]', '', 'g'), 5));
    end if;
    section_token := upper(left(regexp_replace(section_code, '[^A-Za-z0-9]', '', 'g'), 2));
    if class_token is null or class_token = '' or section_token is null or section_token = '' then
      raise exception using errcode = '23514', message = 'Class and section codes are required to generate the student ID.';
    end if;
    school_code := school_code || class_token || section_token;
  end if;

  perform set_config('schooliva.allow_student_identifier_update', 'on', true);
  update public.students
  set student_identifier = school_code || lpad(student_number::text, 4, '0')
  where id = target_student_id;
  perform set_config('schooliva.allow_student_identifier_update', 'off', true);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists student_enrollments_refresh_student_identifier on public.student_enrollments;
create trigger student_enrollments_refresh_student_identifier
after insert or update or delete on public.student_enrollments
for each row execute function public.refresh_student_identifier_for_enrollment();

create or replace function public.prevent_student_identity_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception using errcode = '23514', message = 'Student UUID is permanent and cannot be changed.';
  end if;
  if new.admission_number is distinct from old.admission_number then
    raise exception using errcode = '23514', message = 'Student admission number is permanent and cannot be changed.';
  end if;
  if new.student_number is distinct from old.student_number then
    raise exception using errcode = '23514', message = 'Student number is permanent and cannot be changed.';
  end if;
  if new.student_identifier is distinct from old.student_identifier
    and current_setting('schooliva.allow_student_identifier_update', true) is distinct from 'on' then
    raise exception using errcode = '23514', message = 'Student ID can only change when the class or section changes.';
  end if;
  return new;
end;
$$;

drop trigger if exists students_identity_immutable on public.students;
create trigger students_identity_immutable
before update on public.students
for each row execute function public.prevent_student_identity_change();

create or replace function public.prevent_admission_application_number_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.application_number is distinct from old.application_number then
    raise exception using errcode = '23514', message = 'Application and admission number is permanent and cannot be changed.';
  end if;
  return new;
end;
$$;

drop trigger if exists admissions_application_number_immutable on public.admissions;
create trigger admissions_application_number_immutable
before update on public.admissions
for each row execute function public.prevent_admission_application_number_change();

do $$
declare
  student_record record;
  current_enrollment record;
  school_code text;
  class_token text;
  section_token text;
begin
  perform set_config('schooliva.allow_student_identifier_update', 'on', true);

  for student_record in
    select id, school_id, student_number
    from public.students
  loop
    select upper(left(regexp_replace(code, '[^A-Za-z0-9]', '', 'g'), 4))
    into school_code
    from public.schools
    where id = student_record.school_id;

    select c.grade_level, c.code as class_code, sec.code as section_code
    into current_enrollment
    from public.student_enrollments enrollment
    join public.classes c on c.id = enrollment.class_id and c.school_id = enrollment.school_id
    join public.sections sec on sec.id = enrollment.section_id and sec.school_id = enrollment.school_id and sec.class_id = enrollment.class_id
    where enrollment.school_id = student_record.school_id
      and enrollment.student_id = student_record.id
      and enrollment.status = 'active'
    order by enrollment.enrolled_on desc, enrollment.created_at desc, enrollment.id desc
    limit 1;

    if found then
      if current_enrollment.grade_level is not null then
        class_token := current_enrollment.grade_level::text ||
          case
            when current_enrollment.grade_level % 100 between 11 and 13 then 'TH'
            when current_enrollment.grade_level % 10 = 1 then 'ST'
            when current_enrollment.grade_level % 10 = 2 then 'ND'
            when current_enrollment.grade_level % 10 = 3 then 'RD'
            else 'TH'
          end;
      else
        class_token := upper(left(regexp_replace(current_enrollment.class_code, '[^A-Za-z0-9]', '', 'g'), 5));
      end if;
      section_token := upper(left(regexp_replace(current_enrollment.section_code, '[^A-Za-z0-9]', '', 'g'), 2));
      school_code := school_code || class_token || section_token;
    end if;

    update public.students
    set student_identifier = school_code || lpad(student_record.student_number::text, 4, '0')
    where id = student_record.id;
  end loop;

  perform set_config('schooliva.allow_student_identifier_update', 'off', true);
end;
$$;

alter table public.students
  alter column student_identifier set not null;
