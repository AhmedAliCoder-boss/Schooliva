create or replace function public.get_effective_permissions(target_school_id uuid)
returns table(resource text, action text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct permission.resource, permission.action
  from public.permissions permission
  where public.has_school_access(target_school_id)
    and (
      public.is_super_admin()
      or exists (
       select 1
       from public.user_roles assignment
       join public.roles assigned_role on assigned_role.id = assignment.role_id
       join public.role_permissions role_permission on role_permission.role_id = assigned_role.id
       join public.permissions assigned_permission on assigned_permission.id = role_permission.permission_id
       where assignment.user_id = (select auth.uid())
         and assignment.school_id = target_school_id
         and (assigned_role.school_id = target_school_id or assigned_role.school_id is null)
         and assigned_permission.resource = permission.resource
         and assigned_permission.action = permission.action
      )
    );
$$;

revoke all on function public.get_effective_permissions(uuid) from public, anon;
grant execute on function public.get_effective_permissions(uuid) to authenticated;

create or replace function public.dashboard_trends(target_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  result jsonb := '{}'::jsonb;
begin
  if current_user_id is null or not public.has_school_access(target_school_id) then
    raise exception 'School access denied';
  end if;

  if public.has_permission(target_school_id, 'reports', 'view')
     and (
       public.has_permission(target_school_id, 'students.attendance', 'view')
       or public.has_permission(target_school_id, 'students.attendance', 'manage')
     ) then
    result := result || jsonb_build_object(
      'attendance', coalesce((
        select jsonb_agg(jsonb_build_object('date', day_value, 'value', attendance_value) order by day_value)
        from (
          select days.day_value,
            coalesce(round(avg(case when attendance.status in ('present', 'half_day') then 100 when attendance.status = 'late' then 75 else 0 end), 1), 0) as attendance_value
          from generate_series(current_date - 6, current_date, interval '1 day') as days(day_value)
          left join public.student_attendance attendance
            on attendance.school_id = target_school_id and attendance.attendance_date = days.day_value::date
          group by days.day_value
        ) daily_attendance
      ), '[]'::jsonb)
    );
  end if;

  if public.has_permission(target_school_id, 'fees', 'manage')
     or public.has_permission(target_school_id, 'finance', 'view')
     or public.has_permission(target_school_id, 'finance', 'manage') then
    result := result || jsonb_build_object(
      'payments', coalesce((
        select jsonb_agg(jsonb_build_object('date', day_value, 'value', payment_value) order by day_value)
        from (
          select days.day_value, coalesce(sum(payment.amount), 0) as payment_value
          from generate_series(current_date - 6, current_date, interval '1 day') as days(day_value)
          left join public.fee_payments payment
            on payment.school_id = target_school_id and payment.payment_date = days.day_value::date
          group by days.day_value
        ) daily_payments
      ), '[]'::jsonb)
    );
  end if;

  if public.is_super_admin() then
    result := result || jsonb_build_object(
      'schools_count', (select count(*) from public.schools where is_active)
    );
  end if;

  return result;
end;
$$;

revoke all on function public.dashboard_trends(uuid) from public, anon;
grant execute on function public.dashboard_trends(uuid) to authenticated;

create or replace function public.dashboard_role_metrics(target_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  role_slug text;
  result jsonb := '{}'::jsonb;
begin
  if current_user_id is null or not public.has_school_access(target_school_id) then
    raise exception 'School access denied';
  end if;

  select assigned_role.slug into role_slug
  from public.user_roles assignment
  join public.roles assigned_role on assigned_role.id = assignment.role_id
  where assignment.user_id = current_user_id
    and assignment.school_id = target_school_id
  order by case assigned_role.slug
    when 'super_admin' then 1
    when 'school_admin' then 2
    when 'principal' then 3
    when 'accountant' then 4
    when 'teacher' then 5
    when 'student' then 6
    when 'parent' then 7
    when 'librarian' then 8
    when 'transport_manager' then 9
    when 'hr_manager' then 10
    else 99
  end
  limit 1;

  if role_slug in ('super_admin', 'school_admin', 'principal')
     or (role_slug is null and public.is_super_admin()) then
    return jsonb_build_object(
      'students', (select count(*) from public.students where school_id = target_school_id and status = 'active'),
      'teachers', (select count(*) from public.teachers where school_id = target_school_id and employment_status = 'active'),
      'staff', (select count(*) from public.staff where school_id = target_school_id and employment_status = 'active'),
      'classes', (select count(*) from public.classes where school_id = target_school_id and status = 'active'),
      'attendance_percentage', coalesce((
        select round(avg(case when status in ('present', 'half_day') then 100 when status = 'late' then 75 else 0 end), 1)
        from public.student_attendance
        where school_id = target_school_id and attendance_date >= current_date - 30
      ), 0),
      'fee_collection_today', coalesce((
        select sum(amount) from public.fee_payments
        where school_id = target_school_id and payment_date = current_date
      ), 0),
      'outstanding_fees', coalesce((
        select sum(remaining_amount) from public.fee_invoices
        where school_id = target_school_id and status not in ('paid', 'cancelled')
      ), 0),
      'unread_notifications', (
        select count(*) from public.notifications
        where school_id = target_school_id and recipient_profile_id = current_user_id and read_at is null
      )
    );
  elsif role_slug = 'librarian' and (
    public.has_permission(target_school_id, 'library', 'view')
    or public.has_permission(target_school_id, 'library', 'manage')
  ) then
    return jsonb_build_object(
      'library_titles', (select count(*) from public.library_books where school_id = target_school_id),
      'available_copies', (select count(*) from public.library_book_copies where school_id = target_school_id and status = 'available'),
      'issued_copies', (select count(*) from public.library_book_copies where school_id = target_school_id and status = 'issued'),
      'overdue_books', (select count(*) from public.library_transactions where school_id = target_school_id and status = 'issued' and due_date < current_date)
    );
  elsif role_slug = 'transport_manager' and (
    public.has_permission(target_school_id, 'transport', 'view')
    or public.has_permission(target_school_id, 'transport', 'manage')
  ) then
    return jsonb_build_object(
      'active_vehicles', (select count(*) from public.transport_vehicles where school_id = target_school_id and status = 'active'),
      'active_routes', (select count(*) from public.transport_routes where school_id = target_school_id and status = 'active'),
      'transport_stops', (select count(*) from public.transport_stops where school_id = target_school_id),
      'transport_assignments', (select count(*) from public.transport_student_assignments where school_id = target_school_id and status = 'active')
    );
  elsif role_slug in ('hr_manager', 'hr_staff_manager') then
    if public.has_permission(target_school_id, 'staff', 'view')
       or public.has_permission(target_school_id, 'staff', 'manage') then
      result := result || jsonb_build_object(
        'active_employees', (
        select (select count(*) from public.staff where school_id = target_school_id and employment_status = 'active')
             + (select count(*) from public.teachers where school_id = target_school_id and employment_status = 'active')
        ),
        'employees_on_leave', (
        select (select count(*) from public.staff where school_id = target_school_id and employment_status = 'on_leave')
             + (select count(*) from public.teachers where school_id = target_school_id and employment_status = 'on_leave')
        ),
        'total_employees', (
        select (select count(*) from public.staff where school_id = target_school_id)
             + (select count(*) from public.teachers where school_id = target_school_id)
        )
      );
    end if;

    if public.has_permission(target_school_id, 'leave', 'view')
       or public.has_permission(target_school_id, 'leave', 'manage')
       or public.has_permission(target_school_id, 'leave', 'approve') then
      result := result || jsonb_build_object(
        'pending_leave_requests', (
        select count(*) from public.leave_requests
        where school_id = target_school_id
          and status = 'requested'
          and (staff_id is not null or teacher_id is not null)
        )
      );
    end if;
    return result;
  end if;

  return '{}'::jsonb;
end;
$$;

revoke all on function public.dashboard_role_metrics(uuid) from public, anon;
grant execute on function public.dashboard_role_metrics(uuid) to authenticated;
