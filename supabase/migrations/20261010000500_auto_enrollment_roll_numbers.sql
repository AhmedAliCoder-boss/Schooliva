create or replace function public.assign_enrollment_roll_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_roll_number bigint;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      new.school_id::text || ':' ||
      new.academic_session_id::text || ':' ||
      new.class_id::text || ':' ||
      new.section_id::text,
      0
    )
  );

  select coalesce(max(roll_number::bigint), 0) + 1
  into next_roll_number
  from public.student_enrollments
  where school_id = new.school_id
    and academic_session_id = new.academic_session_id
    and class_id = new.class_id
    and section_id = new.section_id
    and roll_number ~ '^[0-9]+$';

  new.roll_number := next_roll_number::text;
  return new;
end;
$$;

drop trigger if exists student_enrollments_assign_roll_number on public.student_enrollments;
create trigger student_enrollments_assign_roll_number
before insert on public.student_enrollments
for each row execute function public.assign_enrollment_roll_number();
