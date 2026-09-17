create or replace function public.dashboard_summary(target_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  role_slug text;
  result jsonb;
  v_teacher_id uuid;
  v_student_id uuid;
  v_parent_id uuid;
begin
  if current_user_id is null or not public.has_school_access(target_school_id) then
    raise exception 'School access denied';
  end if;

  select r.slug into role_slug
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = current_user_id and ur.school_id = target_school_id
  order by case r.slug when 'super_admin' then 1 when 'school_admin' then 2 when 'principal' then 3 else 9 end
  limit 1;

  select id into v_teacher_id from public.teachers where school_id = target_school_id and profile_id = current_user_id limit 1;
  select id into v_student_id from public.students where school_id = target_school_id and profile_id = current_user_id limit 1;
  select id into v_parent_id from public.parents where school_id = target_school_id and profile_id = current_user_id limit 1;

  result := jsonb_build_object(
    'role', coalesce(role_slug, 'member'),
    'unread_notifications', (select count(*) from public.notifications where school_id = target_school_id and recipient_profile_id = current_user_id and read_at is null)
  );

  if role_slug in ('super_admin', 'school_admin', 'principal') then
    result := result || jsonb_build_object(
      'students', (select count(*) from public.students where school_id = target_school_id and status = 'active'),
      'teachers', (select count(*) from public.teachers where school_id = target_school_id and employment_status = 'active'),
      'staff', (select count(*) from public.staff where school_id = target_school_id and employment_status = 'active'),
      'classes', (select count(*) from public.classes where school_id = target_school_id and status = 'active'),
      'attendance_percentage', coalesce((select round(avg(case when status in ('present', 'half_day') then 100 when status = 'late' then 75 else 0 end), 1) from public.student_attendance where school_id = target_school_id and attendance_date >= current_date - 30), 0),
      'fee_collection_today', coalesce((select sum(amount) from public.fee_payments where school_id = target_school_id and payment_date = current_date), 0),
      'outstanding_fees', coalesce((select sum(remaining_amount) from public.fee_invoices where school_id = target_school_id and status not in ('paid', 'cancelled')), 0),
      'recent_activity', coalesce((select jsonb_agg(to_jsonb(activity) order by activity.created_at desc) from (select entity_type, action, created_at from public.finance_audit_logs where school_id = target_school_id order by created_at desc limit 5) activity), '[]'::jsonb)
    );
  elsif role_slug = 'accountant' then
    result := result || jsonb_build_object(
      'collection_today', coalesce((select sum(amount) from public.fee_payments where school_id = target_school_id and payment_date = current_date), 0),
      'outstanding_fees', coalesce((select sum(remaining_amount) from public.fee_invoices where school_id = target_school_id and status not in ('paid', 'cancelled')), 0),
      'overdue_invoices', (select count(*) from public.fee_invoices where school_id = target_school_id and status = 'overdue'),
      'payments_today', (select count(*) from public.fee_payments where school_id = target_school_id and payment_date = current_date)
    );
  elsif role_slug = 'teacher' then
    result := result || jsonb_build_object(
      'assigned_classes', coalesce((select count(distinct ta.class_id) from public.teacher_assignments ta where ta.school_id = target_school_id and ta.teacher_id = v_teacher_id), 0),
      'today_timetable', (select count(*) from public.timetable_entries te where te.school_id = target_school_id and te.teacher_id = v_teacher_id and te.day_of_week = extract(isodow from current_date) and te.status = 'active'),
      'assignments', (select count(*) from public.assignments a where a.school_id = target_school_id and a.teacher_id = v_teacher_id and a.status = 'open'),
      'upcoming_exams', (select count(*) from public.exam_schedules es join public.exam_subjects exs on exs.id = es.exam_subject_id join public.exams e on e.id = exs.exam_id where es.school_id = target_school_id and e.status in ('submitted', 'reviewed') and es.scheduled_on >= current_date)
    );
  elsif role_slug = 'parent' then
    result := result || jsonb_build_object(
      'children', (select count(*) from public.student_parents sp where sp.school_id = target_school_id and sp.parent_id = v_parent_id),
      'unread_assignments', (select count(*) from public.assignments a join public.student_enrollments se on se.class_id = a.class_id and se.section_id = a.section_id and se.school_id = a.school_id join public.student_parents sp on sp.student_id = se.student_id and sp.school_id = se.school_id where a.school_id = target_school_id and sp.parent_id = v_parent_id and a.status = 'open'),
      'children_absence_last_30', (select count(*) from public.student_attendance sa join public.student_parents sp on sp.student_id = sa.student_id and sp.school_id = sa.school_id where sa.school_id = target_school_id and sp.parent_id = v_parent_id and sa.status = 'absent' and sa.attendance_date >= current_date - 30)
    );
  elsif role_slug = 'student' then
    result := result || jsonb_build_object(
      'today_timetable', (select count(*) from public.timetable_entries te join public.student_enrollments se on se.class_id = te.class_id and se.section_id = te.section_id and se.school_id = te.school_id where te.school_id = target_school_id and se.student_id = v_student_id and te.day_of_week = extract(isodow from current_date) and te.status = 'active'),
      'open_assignments', (select count(*) from public.assignments a join public.student_enrollments se on se.class_id = a.class_id and se.section_id = a.section_id and se.school_id = a.school_id where a.school_id = target_school_id and se.student_id = v_student_id and a.status = 'open'),
      'unread_notifications', (select count(*) from public.notifications where school_id = target_school_id and recipient_profile_id = current_user_id and read_at is null)
    );
  end if;

  return result;
end;
$$;

insert into public.permissions (resource, action, description)
values ('dashboard', 'view', 'View role-specific dashboard metrics')
on conflict (resource, action) do update set description = excluded.description;
