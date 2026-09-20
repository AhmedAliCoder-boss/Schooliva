create or replace function public.dashboard_trends(target_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  result jsonb;
begin
  if current_user_id is null or not public.has_school_access(target_school_id) then
    raise exception 'School access denied';
  end if;

  result := jsonb_build_object(
    'attendance', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', day_value,
        'value', attendance_value
      ) order by day_value)
      from (
        select days.day_value,
          coalesce(round(avg(case when sa.status in ('present', 'half_day') then 100 when sa.status = 'late' then 75 else 0 end), 1), 0) as attendance_value
        from generate_series(current_date - 6, current_date, interval '1 day') as days(day_value)
        left join public.student_attendance sa
          on sa.school_id = target_school_id and sa.attendance_date = days.day_value::date
        group by days.day_value
      ) daily_attendance
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', day_value,
        'value', payment_value
      ) order by day_value)
      from (
        select days.day_value,
          coalesce(sum(fp.amount), 0) as payment_value
        from generate_series(current_date - 6, current_date, interval '1 day') as days(day_value)
        left join public.fee_payments fp
          on fp.school_id = target_school_id and fp.payment_date = days.day_value::date
        group by days.day_value
      ) daily_payments
    ), '[]'::jsonb),
    'schools_count', case when public.is_super_admin() then (select count(*) from public.schools where is_active) else 0 end
  );

  return result;
end;
$$;

grant execute on function public.dashboard_trends(uuid) to authenticated;
