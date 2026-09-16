create or replace function public.global_search(target_school_id uuid, search_term text, entity_scope text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  term text := trim(search_term);
  student_results jsonb := '[]'::jsonb;
  teacher_results jsonb := '[]'::jsonb;
  parent_results jsonb := '[]'::jsonb;
  class_results jsonb := '[]'::jsonb;
  invoice_results jsonb := '[]'::jsonb;
  book_results jsonb := '[]'::jsonb;
  assignment_results jsonb := '[]'::jsonb;
begin
  if term is null or length(term) < 2 then
    return jsonb_build_object(
      'students', '[]'::jsonb,
      'teachers', '[]'::jsonb,
      'parents', '[]'::jsonb,
      'classes', '[]'::jsonb,
      'invoices', '[]'::jsonb,
      'books', '[]'::jsonb,
      'assignments', '[]'::jsonb
    );
  end if;

  if entity_scope is null or entity_scope = 'students' then
    if public.has_permission(target_school_id, 'students', 'view') then
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'type', 'student',
        'title', concat_ws(' ', s.first_name, s.middle_name, s.last_name),
        'subtitle', concat('Adm. ', coalesce(s.admission_number, '-')),
        'meta', jsonb_build_object('status', s.status)
      ) order by s.last_name, s.first_name), '[]'::jsonb)
      into student_results
      from public.students s
      where s.school_id = target_school_id and (
        s.first_name ilike '%' || term || '%' or
        s.middle_name ilike '%' || term || '%' or
        s.last_name ilike '%' || term || '%' or
        s.admission_number ilike '%' || term || '%' or
        s.student_identifier ilike '%' || term || '%'
      )
      limit 12;
    end if;
  end if;

  if entity_scope is null or entity_scope = 'teachers' then
    if public.has_permission(target_school_id, 'teachers', 'view') then
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id,
        'type', 'teacher',
        'title', concat_ws(' ', t.first_name, t.last_name),
        'subtitle', coalesce(t.specialization, 'Teacher'),
        'meta', jsonb_build_object('status', t.employment_status)
      ) order by t.last_name, t.first_name), '[]'::jsonb)
      into teacher_results
      from public.teachers t
      where t.school_id = target_school_id and (
        t.first_name ilike '%' || term || '%' or
        t.last_name ilike '%' || term || '%' or
        t.employee_code ilike '%' || term || '%' or
        t.specialization ilike '%' || term || '%'
      )
      limit 12;
    end if;
  end if;

  if entity_scope is null or entity_scope = 'parents' then
    if public.has_permission(target_school_id, 'parents', 'view') then
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'type', 'parent',
        'title', concat_ws(' ', p.first_name, p.last_name),
        'subtitle', coalesce(p.relationship, 'Guardian'),
        'meta', jsonb_build_object('phone', p.phone)
      ) order by p.last_name, p.first_name), '[]'::jsonb)
      into parent_results
      from public.parents p
      where p.school_id = target_school_id and (
        p.first_name ilike '%' || term || '%' or
        p.last_name ilike '%' || term || '%' or
        p.email ilike '%' || term || '%' or
        p.phone ilike '%' || term || '%'
      )
      limit 12;
    end if;
  end if;

  if entity_scope is null or entity_scope = 'classes' then
    if public.has_permission(target_school_id, 'classes', 'view') then
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id,
        'type', 'class',
        'title', c.name,
        'subtitle', coalesce(c.code, 'Class'),
        'meta', jsonb_build_object('status', c.status)
      ) order by c.name), '[]'::jsonb)
      into class_results
      from public.classes c
      where c.school_id = target_school_id and (
        c.name ilike '%' || term || '%' or
        c.code ilike '%' || term || '%' or
        c.description ilike '%' || term || '%'
      )
      limit 12;
    end if;
  end if;

  if entity_scope is null or entity_scope = 'invoices' then
    if public.has_permission(target_school_id, 'fees', 'view') then
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', fi.id,
        'type', 'invoice',
        'title', fi.invoice_number,
        'subtitle', concat('Student: ', coalesce(s.first_name, ''), ' ', coalesce(s.last_name, '')),
        'meta', jsonb_build_object('status', fi.status, 'total', fi.total)
      ) order by fi.due_date desc), '[]'::jsonb)
      into invoice_results
      from public.fee_invoices fi
      left join public.students s on s.id = fi.student_id and s.school_id = fi.school_id
      where fi.school_id = target_school_id and (
        fi.invoice_number ilike '%' || term || '%' or
        s.first_name ilike '%' || term || '%' or
        s.last_name ilike '%' || term || '%'
      )
      limit 12;
    end if;
  end if;

  if entity_scope is null or entity_scope = 'books' then
    if public.has_permission(target_school_id, 'library', 'view') then
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', lb.id,
        'type', 'book',
        'title', lb.title,
        'subtitle', coalesce(lb.isbn, 'Book'),
        'meta', jsonb_build_object('rack_location', lb.rack_location)
      ) order by lb.title), '[]'::jsonb)
      into book_results
      from public.library_books lb
      where lb.school_id = target_school_id and (
        lb.title ilike '%' || term || '%' or
        lb.isbn ilike '%' || term || '%' or
        lb.summary ilike '%' || term || '%'
      )
      limit 12;
    end if;
  end if;

  if entity_scope is null or entity_scope = 'assignments' then
    if public.has_permission(target_school_id, 'assignments', 'view') then
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id,
        'type', 'assignment',
        'title', a.title,
        'subtitle', concat('Due ', a.due_date),
        'meta', jsonb_build_object('status', a.status)
      ) order by a.due_date desc), '[]'::jsonb)
      into assignment_results
      from public.assignments a
      where a.school_id = target_school_id and (
        a.title ilike '%' || term || '%' or
        a.description ilike '%' || term || '%'
      )
      limit 12;
    end if;
  end if;

  return jsonb_build_object(
    'students', coalesce(student_results, '[]'::jsonb),
    'teachers', coalesce(teacher_results, '[]'::jsonb),
    'parents', coalesce(parent_results, '[]'::jsonb),
    'classes', coalesce(class_results, '[]'::jsonb),
    'invoices', coalesce(invoice_results, '[]'::jsonb),
    'books', coalesce(book_results, '[]'::jsonb),
    'assignments', coalesce(assignment_results, '[]'::jsonb)
  );
end;
$$;

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

  result := jsonb_build_object(
    'student_summary', jsonb_build_object(
      'total_students', (select count(*) from public.students where school_id = target_school_id and status = 'active'),
      'active_classes', (select count(*) from public.classes where school_id = target_school_id and status = 'active')
    ),
    'attendance_summary', jsonb_build_object(
      'total_records', (select count(*) from public.student_attendance where school_id = target_school_id and attendance_date between start_date and end_date and (class_filter is null or student_id in (select student_id from public.student_enrollments where school_id = target_school_id and class_id = class_filter and (section_filter is null or section_id = section_filter) and (session_filter is null or academic_session_id = session_filter)))),
      'present_rate', coalesce((select round(avg(case when status in ('present', 'half_day') then 100 when status = 'late' then 75 else 0 end), 1) from public.student_attendance where school_id = target_school_id and attendance_date between start_date and end_date and (class_filter is null or student_id in (select student_id from public.student_enrollments where school_id = target_school_id and class_id = class_filter and (section_filter is null or section_id = section_filter) and (session_filter is null or academic_session_id = session_filter)))), 0)
    ),
    'fee_summary', jsonb_build_object(
      'total_invoices', (select count(*) from public.fee_invoices where school_id = target_school_id and created_at::date between start_date and end_date),
      'total_collected', coalesce((select sum(amount) from public.fee_payments where school_id = target_school_id and payment_date between start_date and end_date), 0),
      'outstanding', coalesce((select sum(remaining_amount) from public.fee_invoices where school_id = target_school_id and status not in ('paid', 'cancelled')), 0)
    ),
    'result_summary', jsonb_build_object(
      'published_exams', (select count(*) from public.exams where school_id = target_school_id and status = 'published' and starts_on between start_date and end_date),
      'average_marks', coalesce((select round(avg(m.obtained_marks), 2) from public.marks m join public.exam_subjects es on es.id = m.exam_subject_id join public.exams e on e.id = es.exam_id where m.school_id = target_school_id and e.status = 'published' and e.starts_on between start_date and end_date), 0)
    ),
    'teacher_summary', jsonb_build_object(
      'active_teachers', (select count(*) from public.teachers where school_id = target_school_id and employment_status = 'active'),
      'open_assignments', (select count(*) from public.assignments where school_id = target_school_id and status = 'open')
    ),
    'library_summary', jsonb_build_object(
      'books_total', (select count(*) from public.library_books where school_id = target_school_id),
      'issued_books', (select count(*) from public.library_transactions where school_id = target_school_id and status = 'issued')
    ),
    'transport_summary', jsonb_build_object(
      'active_routes', (select count(*) from public.transport_routes where school_id = target_school_id and status = 'active'),
      'assigned_students', (select count(*) from public.transport_student_assignments where school_id = target_school_id and status = 'active')
    ),
    'inventory_summary', jsonb_build_object(
      'low_stock_items', (select count(*) from public.inventory_items where school_id = target_school_id and current_quantity <= min_stock_level),
      'total_items', (select count(*) from public.inventory_items where school_id = target_school_id)
    )
  );

  return result;
end;
$$;

create or replace function public.require_school_report_access(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission(target_school_id, 'reports', 'view') or public.is_super_admin();
$$;
