create or replace function public.report_summary(
  target_school_id uuid,
  from_date date default null,
  to_date date default null,
  class_filter uuid default null,
  section_filter uuid default null,
  session_filter uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  start_date date := coalesce(from_date, current_date - 30);
  end_date date := coalesce(to_date, current_date);
  result jsonb;
begin
  if not public.has_permission(target_school_id, 'reports', 'view') then
    raise exception 'Unauthorized';
  end if;
  if end_date < start_date or end_date - start_date > 366 then
    raise exception 'Report date range must be between 1 and 367 days';
  end if;

  result := jsonb_build_object(
    'report_period', jsonb_build_object('from_date', start_date, 'to_date', end_date),
    'student_summary', jsonb_build_object(
      'total_students', (
        select count(*)
        from public.students s
        where s.school_id = target_school_id
          and s.status = 'active'
          and ((class_filter is null and section_filter is null and session_filter is null) or exists (
            select 1 from public.student_enrollments e
            where e.school_id = s.school_id and e.student_id = s.id
              and e.status = 'active'
              and (class_filter is null or e.class_id = class_filter)
              and (section_filter is null or e.section_id = section_filter)
              and (session_filter is null or e.academic_session_id = session_filter)
          ))
      ),
      'active_classes', (
        select count(*) from public.classes c
        where c.school_id = target_school_id and c.status = 'active'
          and (class_filter is null or c.id = class_filter)
      ),
      'by_class', coalesce((
        select jsonb_agg(jsonb_build_object('label', grouped.label, 'students', grouped.students) order by grouped.label)
        from (
          select c.name || ' / ' || sec.name as label, count(distinct e.student_id)::integer as students
          from public.student_enrollments e
          join public.students s on s.school_id = e.school_id and s.id = e.student_id and s.status = 'active'
          join public.classes c on c.school_id = e.school_id and c.id = e.class_id
          join public.sections sec on sec.school_id = e.school_id and sec.id = e.section_id
          where e.school_id = target_school_id and e.status = 'active'
            and (class_filter is null or e.class_id = class_filter)
            and (section_filter is null or e.section_id = section_filter)
            and (session_filter is null or e.academic_session_id = session_filter)
          group by c.name, sec.name
          order by c.name, sec.name
        ) grouped
      ), '[]'::jsonb)
    ),
    'attendance_summary', jsonb_build_object(
      'total_records', (
        select count(*) from public.student_attendance a
        where a.school_id = target_school_id and a.attendance_date between start_date and end_date
          and ((class_filter is null and section_filter is null and session_filter is null) or exists (
            select 1 from public.student_enrollments e
            where e.school_id = a.school_id and e.student_id = a.student_id
              and e.status = 'active'
              and (class_filter is null or e.class_id = class_filter)
              and (section_filter is null or e.section_id = section_filter)
              and (session_filter is null or e.academic_session_id = session_filter)
          ))
      ),
      'present_rate', coalesce((
        select round(avg(case when a.status in ('present', 'half_day') then 100 when a.status = 'late' then 75 else 0 end), 1)
        from public.student_attendance a
        where a.school_id = target_school_id and a.attendance_date between start_date and end_date
          and ((class_filter is null and section_filter is null and session_filter is null) or exists (
            select 1 from public.student_enrollments e
            where e.school_id = a.school_id and e.student_id = a.student_id
              and e.status = 'active'
              and (class_filter is null or e.class_id = class_filter)
              and (section_filter is null or e.section_id = section_filter)
              and (session_filter is null or e.academic_session_id = session_filter)
          ))
      ), 0),
      'by_status', coalesce((
        select jsonb_agg(jsonb_build_object('label', grouped.status, 'count', grouped.total) order by grouped.status)
        from (
          select a.status, count(*)::integer as total
          from public.student_attendance a
          where a.school_id = target_school_id and a.attendance_date between start_date and end_date
            and ((class_filter is null and section_filter is null and session_filter is null) or exists (
              select 1 from public.student_enrollments e
              where e.school_id = a.school_id and e.student_id = a.student_id
                and e.status = 'active'
                and (class_filter is null or e.class_id = class_filter)
                and (section_filter is null or e.section_id = section_filter)
                and (session_filter is null or e.academic_session_id = session_filter)
            ))
          group by a.status
        ) grouped
      ), '[]'::jsonb),
      'daily_trend', coalesce((
        select jsonb_agg(jsonb_build_object('date', days.day, 'records', coalesce(counts.total, 0), 'present', coalesce(counts.present, 0)) order by days.day)
        from generate_series(start_date, end_date, interval '1 day') days(day)
        left join (
          select a.attendance_date, count(*)::integer as total,
            count(*) filter (where a.status in ('present', 'half_day', 'late'))::integer as present
          from public.student_attendance a
          where a.school_id = target_school_id and a.attendance_date between start_date and end_date
            and ((class_filter is null and section_filter is null and session_filter is null) or exists (
              select 1 from public.student_enrollments e
              where e.school_id = a.school_id and e.student_id = a.student_id
                and e.status = 'active'
                and (class_filter is null or e.class_id = class_filter)
                and (section_filter is null or e.section_id = section_filter)
                and (session_filter is null or e.academic_session_id = session_filter)
            ))
          group by a.attendance_date
        ) counts on counts.attendance_date = days.day::date
      ), '[]'::jsonb)
    ),
    'fee_summary', jsonb_build_object(
      'total_invoices', (
        select count(*) from public.fee_invoices i
        where i.school_id = target_school_id and i.created_at::date between start_date and end_date
          and ((class_filter is null and section_filter is null and session_filter is null) or exists (
            select 1 from public.student_enrollments e where e.school_id = i.school_id and e.student_id = i.student_id
              and e.status = 'active'
              and (class_filter is null or e.class_id = class_filter)
              and (section_filter is null or e.section_id = section_filter)
              and (session_filter is null or e.academic_session_id = session_filter)
          ))
      ),
      'total_collected', coalesce((
        select sum(p.amount) from public.fee_payments p
        join public.fee_invoices i on i.school_id = p.school_id and i.id = p.invoice_id
        where p.school_id = target_school_id and p.payment_date between start_date and end_date
          and ((class_filter is null and section_filter is null and session_filter is null) or exists (
            select 1 from public.student_enrollments e where e.school_id = i.school_id and e.student_id = i.student_id
              and e.status = 'active'
              and (class_filter is null or e.class_id = class_filter)
              and (section_filter is null or e.section_id = section_filter)
              and (session_filter is null or e.academic_session_id = session_filter)
          ))
      ), 0),
      'outstanding', coalesce((
        select sum(i.remaining_amount) from public.fee_invoices i
        where i.school_id = target_school_id and i.status not in ('paid', 'cancelled')
          and ((class_filter is null and section_filter is null and session_filter is null) or exists (
            select 1 from public.student_enrollments e where e.school_id = i.school_id and e.student_id = i.student_id
              and e.status = 'active'
              and (class_filter is null or e.class_id = class_filter)
              and (section_filter is null or e.section_id = section_filter)
              and (session_filter is null or e.academic_session_id = session_filter)
          ))
      ), 0),
      'by_status', coalesce((
        select jsonb_agg(jsonb_build_object('label', grouped.status, 'count', grouped.total) order by grouped.status)
        from (
          select i.status::text as status, count(*)::integer as total
          from public.fee_invoices i
          where i.school_id = target_school_id and i.created_at::date between start_date and end_date
            and ((class_filter is null and section_filter is null and session_filter is null) or exists (
              select 1 from public.student_enrollments e where e.school_id = i.school_id and e.student_id = i.student_id
                and e.status = 'active'
                and (class_filter is null or e.class_id = class_filter)
                and (section_filter is null or e.section_id = section_filter)
                and (session_filter is null or e.academic_session_id = session_filter)
            ))
          group by i.status
        ) grouped
      ), '[]'::jsonb),
      'collection_trend', coalesce((
        select jsonb_agg(jsonb_build_object('label', to_char(grouped.month, 'Mon YYYY'), 'amount', grouped.amount) order by grouped.month)
        from (
          select date_trunc('month', p.payment_date)::date as month, sum(p.amount) as amount
          from public.fee_payments p
          join public.fee_invoices i on i.school_id = p.school_id and i.id = p.invoice_id
          where p.school_id = target_school_id and p.payment_date between start_date and end_date
            and (class_filter is null or exists (
              select 1 from public.student_enrollments e where e.school_id = i.school_id and e.student_id = i.student_id
                and e.status = 'active' and e.class_id = class_filter
                and (section_filter is null or e.section_id = section_filter)
                and (session_filter is null or e.academic_session_id = session_filter)
            ))
          group by date_trunc('month', p.payment_date)::date
        ) grouped
      ), '[]'::jsonb)
    ),
    'result_summary', jsonb_build_object(
      'published_exams', (
        select count(*) from public.exams e
        where e.school_id = target_school_id and e.status = 'published' and e.starts_on between start_date and end_date
          and (session_filter is null or e.academic_session_id = session_filter)
          and (class_filter is null or exists (select 1 from public.exam_subjects es where es.school_id = e.school_id and es.exam_id = e.id and es.class_id = class_filter))
          and (section_filter is null or exists (
            select 1 from public.exam_subjects es join public.exam_schedules sch on sch.school_id = es.school_id and sch.exam_subject_id = es.id
            where es.school_id = e.school_id and es.exam_id = e.id and sch.section_id = section_filter
          ))
      ),
      'average_marks', coalesce((
        select round(avg(m.percentage), 2)
        from public.marks m
        join public.exam_subjects es on es.school_id = m.school_id and es.id = m.exam_subject_id
        join public.exams e on e.school_id = es.school_id and e.id = es.exam_id
        where m.school_id = target_school_id and e.status = 'published' and e.starts_on between start_date and end_date
          and (session_filter is null or e.academic_session_id = session_filter)
          and (class_filter is null or es.class_id = class_filter)
          and (section_filter is null or exists (
            select 1 from public.student_enrollments enrollment
            where enrollment.school_id = m.school_id and enrollment.student_id = m.student_id
              and enrollment.status = 'active' and enrollment.class_id = es.class_id
              and enrollment.section_id = section_filter
              and enrollment.academic_session_id = e.academic_session_id
          ))
      ), 0),
      'pass_rate', coalesce((
        select round(100.0 * count(*) filter (where m.obtained_marks >= coalesce(es.passing_marks, es.maximum_marks * 0.4)) / nullif(count(*), 0), 1)
        from public.marks m
        join public.exam_subjects es on es.school_id = m.school_id and es.id = m.exam_subject_id
        join public.exams e on e.school_id = es.school_id and e.id = es.exam_id
        where m.school_id = target_school_id and e.status = 'published' and e.starts_on between start_date and end_date
          and (session_filter is null or e.academic_session_id = session_filter)
          and (class_filter is null or es.class_id = class_filter)
          and (section_filter is null or exists (
            select 1 from public.student_enrollments enrollment
            where enrollment.school_id = m.school_id and enrollment.student_id = m.student_id
              and enrollment.status = 'active' and enrollment.class_id = es.class_id
              and enrollment.section_id = section_filter
              and enrollment.academic_session_id = e.academic_session_id
          ))
      ), 0)
    ),
    'teacher_summary', jsonb_build_object(
      'active_teachers', (select count(*) from public.teachers where school_id = target_school_id and employment_status = 'active'),
      'open_assignments', (select count(*) from public.assignments where school_id = target_school_id and status = 'open' and created_at::date between start_date and end_date
        and (session_filter is null or academic_session_id = session_filter)
        and (class_filter is null or class_id = class_filter)
        and (section_filter is null or section_id = section_filter))
    ),
    'library_summary', jsonb_build_object(
      'books_total', (select count(*) from public.library_books where school_id = target_school_id),
      'issued_books', (select count(*) from public.library_transactions where school_id = target_school_id and status = 'issued'),
      'overdue_books', (select count(*) from public.library_transactions where school_id = target_school_id and (status = 'overdue' or (status = 'issued' and due_date < current_date)))
    ),
    'transport_summary', jsonb_build_object(
      'active_routes', (select count(*) from public.transport_routes where school_id = target_school_id and status = 'active'),
      'assigned_students', (select count(distinct student_id) from public.transport_student_assignments where school_id = target_school_id and status = 'active')
    ),
    'inventory_summary', jsonb_build_object(
      'low_stock_items', (select count(*) from public.inventory_items where school_id = target_school_id and status = 'active' and current_quantity <= min_stock_level),
      'total_items', (select count(*) from public.inventory_items where school_id = target_school_id and status = 'active'),
      'stock_value', coalesce((select sum(cost * current_quantity) from public.inventory_items where school_id = target_school_id and status = 'active'), 0),
      'by_category', coalesce((
        select jsonb_agg(jsonb_build_object('label', grouped.label, 'items', grouped.items, 'quantity', grouped.quantity, 'value', grouped.value) order by grouped.label)
        from (
          select c.name as label, count(i.id)::integer as items, coalesce(sum(i.current_quantity), 0)::integer as quantity,
            coalesce(sum(i.cost * i.current_quantity), 0) as value
          from public.inventory_items i
          join public.inventory_categories c on c.school_id = i.school_id and c.id = i.category_id
          where i.school_id = target_school_id and i.status = 'active'
          group by c.name
          order by c.name
        ) grouped
      ), '[]'::jsonb)
    )
  );

  return result;
end;
$$;

create or replace function public.report_filter_options(target_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_permission(target_school_id, 'reports', 'view') then
    raise exception 'Unauthorized';
  end if;

  return jsonb_build_object(
    'classes', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name)
      from public.classes
      where school_id = target_school_id and status = 'active'
    ), '[]'::jsonb),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'class_id', class_id) order by name)
      from public.sections
      where school_id = target_school_id
    ), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'is_current', is_current) order by starts_on desc)
      from public.academic_sessions
      where school_id = target_school_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.report_filter_options(uuid) from public;
grant execute on function public.report_filter_options(uuid) to authenticated;
