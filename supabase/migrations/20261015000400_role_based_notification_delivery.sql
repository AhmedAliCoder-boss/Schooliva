insert into public.permissions (resource, action, description)
values
  ('notifications', 'view', 'View personal in-app notifications'),
  ('notifications', 'manage', 'Send school notifications to selected roles')
on conflict (resource, action) do update
set description = excluded.description;

do $$
declare
  role_record record;
  notification_manage_permission_id uuid;
begin
  select id into notification_manage_permission_id
  from public.permissions
  where resource = 'notifications' and action = 'manage';

  for role_record in
    select id
    from public.roles
    where slug in ('school_admin', 'principal')
  loop
    insert into public.role_permissions (role_id, permission_id)
    values (role_record.id, notification_manage_permission_id)
    on conflict (role_id, permission_id) do nothing;
  end loop;
end;
$$;

create or replace function public.get_notification_recipient_roles(target_school_id uuid)
returns table (slug text, name text, recipient_count bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin()
     and not public.has_permission(target_school_id, 'notifications', 'manage') then
    raise exception 'Not authorized to view notification recipient roles';
  end if;

  return query
  select role_record.slug, role_record.name, count(distinct user_roles.user_id)
  from public.user_roles
  join public.roles role_record on role_record.id = user_roles.role_id
  join public.profiles on profiles.id = user_roles.user_id and profiles.is_active
  where user_roles.school_id = target_school_id
  group by role_record.slug, role_record.name
  having count(distinct user_roles.user_id) > 0
  order by role_record.name;
end;
$$;

revoke all on function public.get_notification_recipient_roles(uuid) from public;
grant execute on function public.get_notification_recipient_roles(uuid) to authenticated;

create or replace function public.create_role_in_app_notifications(
  target_school_id uuid,
  target_role_slugs text[],
  target_event_type text,
  target_title text,
  target_message text,
  target_entity_type text default null,
  target_entity_id uuid default null,
  target_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_profile_id uuid;
  created_count integer := 0;
begin
  if not public.is_super_admin()
     and not public.has_permission(target_school_id, 'notifications', 'manage') then
    raise exception 'Not authorized to send school notifications';
  end if;

  if coalesce(array_length(target_role_slugs, 1), 0) = 0
     or length(trim(coalesce(target_event_type, ''))) = 0
     or length(trim(coalesce(target_title, ''))) = 0
     or length(trim(coalesce(target_message, ''))) = 0 then
    raise exception 'Notification recipients and content are required';
  end if;

  for recipient_profile_id in
    select distinct user_roles.user_id
    from public.user_roles
    join public.roles on roles.id = user_roles.role_id
    join public.profiles on profiles.id = user_roles.user_id and profiles.is_active
    where user_roles.school_id = target_school_id
      and roles.slug = any(target_role_slugs)
  loop
    if public.create_in_app_notification(
      target_school_id,
      recipient_profile_id,
      target_event_type,
      target_title,
      target_message,
      target_entity_type,
      target_entity_id,
      coalesce(target_metadata, '{}'::jsonb)
    ) is not null then
      created_count := created_count + 1;
    end if;
  end loop;

  return created_count;
end;
$$;

revoke all on function public.create_role_in_app_notifications(uuid, text[], text, text, text, text, uuid, jsonb) from public;
grant execute on function public.create_role_in_app_notifications(uuid, text[], text, text, text, text, uuid, jsonb) to authenticated;

create or replace function public.notify_school_notification_roles(
  target_school_id uuid,
  target_role_slugs text[],
  target_event_type text,
  target_title text,
  target_message text,
  target_entity_type text,
  target_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare recipient_profile_id uuid;
begin
  for recipient_profile_id in
    select distinct user_roles.user_id
    from public.user_roles
    join public.roles on roles.id = user_roles.role_id
    join public.profiles on profiles.id = user_roles.user_id and profiles.is_active
    where user_roles.school_id = target_school_id
      and roles.slug = any(target_role_slugs)
  loop
    perform public.create_in_app_notification(
      target_school_id, recipient_profile_id, target_event_type, target_title,
      target_message, target_entity_type, target_entity_id, '{}'::jsonb
    );
  end loop;
end;
$$;

create or replace function public.notify_student_parents(
  target_school_id uuid,
  target_student_id uuid,
  target_event_type text,
  target_title text,
  target_message text,
  target_entity_type text,
  target_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare recipient_profile_id uuid;
begin
  for recipient_profile_id in
    select distinct parents.profile_id
    from public.student_parents
    join public.parents
      on parents.school_id = student_parents.school_id
     and parents.id = student_parents.parent_id
     and parents.is_active
     and parents.deleted_at is null
    join public.profiles
      on profiles.id = parents.profile_id
     and profiles.is_active
    join public.user_roles
      on user_roles.school_id = student_parents.school_id
     and user_roles.user_id = parents.profile_id
    join public.roles
      on roles.id = user_roles.role_id
     and roles.slug = 'parent'
    where student_parents.school_id = target_school_id
      and student_parents.student_id = target_student_id
      and parents.profile_id is not null
  loop
    perform public.create_in_app_notification(
      target_school_id, recipient_profile_id, target_event_type, target_title,
      target_message, target_entity_type, target_entity_id, '{}'::jsonb
    );
  end loop;
end;
$$;

create or replace function public.notify_on_student_absence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare student_label text;
begin
  if new.status <> 'absent'
     or (tg_op = 'UPDATE' and old.status is not distinct from new.status) then
    return new;
  end if;

  select concat_ws(' ', first_name, last_name)
    into student_label
  from public.students
  where school_id = new.school_id and id = new.student_id;

  perform public.notify_student_parents(
    new.school_id, new.student_id, 'student_absent', 'Student marked absent',
    coalesce(student_label, 'Your student') || ' was marked absent on ' || new.attendance_date::text || '.',
    'student_attendance', new.id
  );
  return new;
end;
$$;

create trigger student_attendance_notify_absent
after insert or update of status on public.student_attendance
for each row execute function public.notify_on_student_absence();

create or replace function public.notify_on_fee_invoice_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_student_parents(
    new.school_id, new.student_id, 'fee_invoice_created', 'New fee invoice',
    'Invoice ' || new.invoice_number || ' for ' || new.total::text || ' is due on ' || new.due_date::text || '.',
    'fee_invoices', new.id
  );
  return new;
end;
$$;

create trigger fee_invoice_notify_created
after insert on public.fee_invoices
for each row execute function public.notify_on_fee_invoice_created();

create or replace function public.notify_on_fee_invoice_overdue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'overdue'
     or (tg_op = 'UPDATE' and old.status is not distinct from new.status) then
    return new;
  end if;

  perform public.notify_student_parents(
    new.school_id, new.student_id, 'fee_overdue', 'Invoice overdue',
    'Invoice ' || new.invoice_number || ' has an outstanding balance of ' || new.remaining_amount::text || '.',
    'fee_invoices', new.id
  );
  perform public.notify_school_notification_roles(
    new.school_id, array['school_admin', 'principal', 'accountant'],
    'fee_overdue', 'Invoice overdue',
    'Invoice ' || new.invoice_number || ' is overdue with ' || new.remaining_amount::text || ' outstanding.',
    'fee_invoices', new.id
  );
  return new;
end;
$$;

create trigger fee_invoice_notify_overdue
after insert or update of status on public.fee_invoices
for each row execute function public.notify_on_fee_invoice_overdue();

create or replace function public.notify_on_fee_payment_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare invoice_record public.fee_invoices%rowtype;
begin
  select * into invoice_record
  from public.fee_invoices
  where school_id = new.school_id and id = new.invoice_id;
  if not found then
    return new;
  end if;

  perform public.notify_student_parents(
    new.school_id, invoice_record.student_id, 'payment_received', 'Fee payment received',
    new.amount::text || ' was received for invoice ' || invoice_record.invoice_number || '.',
    'fee_invoices', invoice_record.id
  );
  perform public.notify_school_notification_roles(
    new.school_id, array['school_admin', 'principal', 'accountant'],
    'payment_received', 'Fee payment received',
    new.amount::text || ' received for invoice ' || invoice_record.invoice_number || '.',
    'fee_invoices', invoice_record.id
  );
  return new;
end;
$$;

create trigger fee_payment_notify_received
after insert on public.fee_payments
for each row execute function public.notify_on_fee_payment_received();

create or replace function public.notify_on_assignment_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  student_record record;
  teacher_profile_id uuid;
begin
  if new.status <> 'open'
     or (tg_op = 'UPDATE' and old.status is not distinct from new.status) then
    return new;
  end if;

  for student_record in
    select distinct parents.profile_id
    from public.student_enrollments
    join public.students
      on students.school_id = student_enrollments.school_id
     and students.id = student_enrollments.student_id
    join public.student_parents
      on student_parents.school_id = students.school_id
     and student_parents.student_id = students.id
    join public.parents
      on parents.school_id = student_parents.school_id
     and parents.id = student_parents.parent_id
     and parents.is_active
     and parents.deleted_at is null
    join public.profiles
      on profiles.id = parents.profile_id
     and profiles.is_active
    join public.user_roles
      on user_roles.school_id = parents.school_id
     and user_roles.user_id = parents.profile_id
    join public.roles
      on roles.id = user_roles.role_id
     and roles.slug = 'parent'
    where student_enrollments.school_id = new.school_id
      and student_enrollments.academic_session_id = new.academic_session_id
      and student_enrollments.section_id = new.section_id
      and student_enrollments.status = 'active'
      and parents.profile_id is not null
  loop
    perform public.create_in_app_notification(
      new.school_id, student_record.profile_id, 'assignment_created',
      'New assignment: ' || new.title,
      'A new assignment is due on ' || new.due_date::text || '.',
      'assignments', new.id, '{}'::jsonb
    );
  end loop;

  select teachers.profile_id into teacher_profile_id
  from public.teachers
  join public.profiles
    on profiles.id = teachers.profile_id
   and profiles.is_active
  join public.user_roles
    on user_roles.school_id = teachers.school_id
   and user_roles.user_id = teachers.profile_id
  join public.roles
    on roles.id = user_roles.role_id
   and roles.slug = 'teacher'
  where teachers.school_id = new.school_id and teachers.id = new.teacher_id and teachers.employment_status = 'active';
  if teacher_profile_id is not null then
    perform public.create_in_app_notification(
      new.school_id, teacher_profile_id, 'assignment_created',
      'Assignment published: ' || new.title,
      'Your assignment is now open for students and is due on ' || new.due_date::text || '.',
      'assignments', new.id, '{}'::jsonb
    );
  end if;

  perform public.notify_school_notification_roles(
    new.school_id, array['school_admin', 'principal'],
    'assignment_created', 'Assignment published: ' || new.title,
    'A new assignment is open for students and is due on ' || new.due_date::text || '.',
    'assignments', new.id
  );
  return new;
end;
$$;

create trigger assignments_notify_open
after insert or update of status on public.assignments
for each row execute function public.notify_on_assignment_published();

create or replace function public.notify_on_leave_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  perform public.create_in_app_notification(
    new.school_id, new.requester_profile_id, 'leave_status_changed',
    'Leave request ' || replace(new.status, '_', ' '),
    'Your leave request from ' || new.start_date::text || ' to ' || new.end_date::text ||
      ' is now ' || replace(new.status, '_', ' ') || '.',
    'leave_requests', new.id, '{}'::jsonb
  );
  return new;
end;
$$;

create trigger leave_requests_notify_status
after update of status on public.leave_requests
for each row execute function public.notify_on_leave_status_change();

revoke all on function public.notify_school_notification_roles(uuid, text[], text, text, text, text, uuid) from public;
revoke all on function public.notify_student_parents(uuid, uuid, text, text, text, text, uuid) from public;
revoke all on function public.notify_on_student_absence() from public;
revoke all on function public.notify_on_fee_invoice_created() from public;
revoke all on function public.notify_on_fee_invoice_overdue() from public;
revoke all on function public.notify_on_fee_payment_received() from public;
revoke all on function public.notify_on_assignment_published() from public;
revoke all on function public.notify_on_leave_status_change() from public;
