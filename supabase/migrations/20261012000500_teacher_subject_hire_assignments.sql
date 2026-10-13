alter table public.teacher_assignments
  drop constraint if exists teacher_assignments_check;

alter table public.teacher_assignments
  add constraint teacher_assignments_check
  check (
    (assignment_type = 'class' and class_id is not null and section_id is null and subject_id is null)
    or (assignment_type = 'section' and section_id is not null and class_id is null and subject_id is null)
    or (assignment_type = 'subject' and subject_id is not null and section_id is null)
  );

drop index if exists public.teacher_assignments_unique_key;
create unique index teacher_assignments_class_unique_key
  on public.teacher_assignments (school_id, teacher_id, class_id)
  where assignment_type = 'class';
create unique index teacher_assignments_section_unique_key
  on public.teacher_assignments (school_id, teacher_id, section_id)
  where assignment_type = 'section';
create unique index teacher_assignments_subject_unique_key
  on public.teacher_assignments (
    school_id,
    teacher_id,
    academic_session_id,
    subject_id,
    coalesce(class_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where assignment_type = 'subject';

drop policy if exists "Authorized users can read teacher assignments" on public.teacher_assignments;
create policy "Authorized users can read teacher assignments"
on public.teacher_assignments for select to authenticated
using (
  public.has_permission(school_id, 'teachers', 'view')
  or public.has_permission(school_id, 'curriculum', 'view')
  or public.has_permission(school_id, 'exams', 'view')
  or public.is_super_admin()
);

create or replace function public.complete_hrm_hire_with_subjects(
  p_school_id uuid,
  p_candidate_id uuid,
  p_photo_path text,
  p_documents jsonb,
  p_academic_session_id uuid,
  p_subject_assignments jsonb
)
returns table (
  employee_id uuid,
  employee_type text,
  employee_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hire record;
begin
  if auth.uid() is null
     or not public.is_account_active()
     or not public.has_permission(p_school_id, 'recruitment', 'manage')
     or not (
       public.is_super_admin()
       or exists (
         select 1
           from public.user_roles ur
           join public.roles r on r.id = ur.role_id
          where ur.user_id = auth.uid()
            and ur.school_id = p_school_id
            and r.slug in ('school_admin', 'principal')
       )
     ) then
    raise exception 'Only a Principal, School Admin, or Master Admin can complete this hire.';
  end if;

  if p_subject_assignments is null or jsonb_typeof(p_subject_assignments) <> 'array' then
    raise exception 'Teacher subject assignments must be provided as an array.';
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(p_subject_assignments) as assignment("subjectId" uuid, "classId" uuid)
     group by assignment."subjectId", coalesce(assignment."classId", '00000000-0000-0000-0000-000000000000'::uuid)
    having count(*) > 1
  ) then
    raise exception 'Duplicate teacher subject and class assignments are not allowed.';
  end if;

  if jsonb_array_length(p_subject_assignments) > 0 then
    if p_academic_session_id is null or not exists (
      select 1
        from public.academic_sessions session
       where session.id = p_academic_session_id
         and session.school_id = p_school_id
         and session.status = 'active'
    ) then
      raise exception 'Choose an active academic session for teacher subject assignments.';
    end if;

    if not public.has_permission(p_school_id, 'teachers', 'manage') then
      raise exception 'You do not have permission to assign teacher subjects.';
    end if;

    if exists (
      select 1
        from jsonb_to_recordset(p_subject_assignments) as assignment("subjectId" uuid, "classId" uuid)
        left join public.subjects subject
          on subject.id = assignment."subjectId"
         and subject.school_id = p_school_id
         and subject.status = 'active'
        left join public.classes class
          on class.id = assignment."classId"
         and class.school_id = p_school_id
         and class.status = 'active'
        left join public.class_subjects class_subject
          on class_subject.school_id = p_school_id
         and class_subject.class_id = assignment."classId"
         and class_subject.subject_id = assignment."subjectId"
       where subject.id is null
          or (assignment."classId" is not null and (class.id is null or class_subject.id is null))
    ) then
      raise exception 'Choose active subjects and only classes where the subject is assigned.';
    end if;
  end if;

  select *
    into v_hire
    from public.complete_hrm_hire(p_school_id, p_candidate_id, p_photo_path, p_documents);

  if v_hire.employee_type = 'teacher' then
    if jsonb_array_length(p_subject_assignments) = 0 then
      raise exception 'Assign at least one subject to the teacher before completing the hire.';
    end if;

    insert into public.teacher_assignments (
      school_id,
      academic_session_id,
      teacher_id,
      assignment_type,
      class_id,
      subject_id
    )
    select
      p_school_id,
      p_academic_session_id,
      v_hire.employee_id,
      'subject',
      assignment."classId",
      assignment."subjectId"
    from jsonb_to_recordset(p_subject_assignments) as assignment("subjectId" uuid, "classId" uuid);
  elsif jsonb_array_length(p_subject_assignments) > 0 or p_academic_session_id is not null then
    raise exception 'Subject assignments are only valid for teacher hires.';
  end if;

  return query select v_hire.employee_id, v_hire.employee_type, v_hire.employee_code;
end;
$$;

revoke all on function public.complete_hrm_hire_with_subjects(uuid, uuid, text, jsonb, uuid, jsonb) from public, anon;
grant execute on function public.complete_hrm_hire_with_subjects(uuid, uuid, text, jsonb, uuid, jsonb) to authenticated;
