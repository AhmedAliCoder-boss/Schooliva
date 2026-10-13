create table public.student_promotion_notification_dispatches (
  school_id uuid not null,
  academic_session_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (school_id, academic_session_id),
  foreign key (school_id, academic_session_id)
    references public.academic_sessions (school_id, id) on delete cascade
);

alter table public.student_promotion_notification_dispatches enable row level security;
revoke all on public.student_promotion_notification_dispatches from public, anon, authenticated;

create or replace function public.notify_staff_when_session_results_are_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  exam_count integer;
  published_exam_count integer;
  recipient_profile_id uuid;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(new.school_id::text || ':' || new.academic_session_id::text, 0)
  );

  select count(*), count(*) filter (where status = 'published')
    into exam_count, published_exam_count
  from public.exams
  where school_id = new.school_id
    and academic_session_id = new.academic_session_id;

  if exam_count = 0 or exam_count <> published_exam_count then
    return new;
  end if;

  insert into public.student_promotion_notification_dispatches (school_id, academic_session_id)
  values (new.school_id, new.academic_session_id)
  on conflict do nothing;
  if not found then
    return new;
  end if;

  for recipient_profile_id in
    select recipients.profile_id
    from (
      select user_roles.user_id as profile_id
      from public.user_roles
      join public.roles on roles.id = user_roles.role_id
      join public.profiles on profiles.id = user_roles.user_id and profiles.is_active
      where user_roles.school_id = new.school_id
        and roles.slug in ('school_admin', 'principal')

      union

      select teachers.profile_id
      from public.student_enrollments
      join public.sections
        on sections.id = student_enrollments.section_id
       and sections.school_id = student_enrollments.school_id
      join public.teachers
        on teachers.id = sections.class_teacher_id
       and teachers.school_id = sections.school_id
       and teachers.employment_status = 'active'
      join public.profiles
        on profiles.id = teachers.profile_id
       and profiles.is_active
      join public.user_roles
        on user_roles.user_id = teachers.profile_id
       and user_roles.school_id = student_enrollments.school_id
      join public.roles
        on roles.id = user_roles.role_id
       and roles.slug = 'teacher'
      where student_enrollments.school_id = new.school_id
        and student_enrollments.academic_session_id = new.academic_session_id
        and student_enrollments.status = 'active'
        and teachers.profile_id is not null
    ) as recipients
  loop
    perform public.create_in_app_notification(
      new.school_id,
      recipient_profile_id,
      'student_promotion_review',
      'Student promotion review is ready',
      'All exam results for this academic session are published. Review your assigned students for promotion.',
      'academic_session',
      new.academic_session_id,
      jsonb_build_object('academic_session_id', new.academic_session_id)
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists exams_notify_session_promotion_review on public.exams;
create trigger exams_notify_session_promotion_review
after update of status on public.exams
for each row
when (new.status = 'published' and old.status is distinct from new.status)
execute function public.notify_staff_when_session_results_are_published();
