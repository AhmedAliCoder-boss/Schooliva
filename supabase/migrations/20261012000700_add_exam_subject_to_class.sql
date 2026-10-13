create or replace function public.add_exam_subject_to_class(
  p_school_id uuid,
  p_exam_id uuid,
  p_class_id uuid,
  p_subject_id uuid,
  p_maximum_marks numeric,
  p_passing_marks numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam_status text;
  v_exam_subject_id uuid;
begin
  if auth.uid() is null
     or not public.is_account_active()
     or not public.has_permission(p_school_id, 'exams', 'manage')
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
    raise exception 'Only exam managers can add exam subjects.';
  end if;

  select status
    into v_exam_status
    from public.exams
   where id = p_exam_id
     and school_id = p_school_id
   for update;

  if not found or v_exam_status <> 'draft' then
    raise exception 'Only a draft exam can be edited.';
  end if;

  if not exists (
    select 1
      from public.classes
     where id = p_class_id
       and school_id = p_school_id
       and status = 'active'
  ) then
    raise exception 'Select an active class from this school.';
  end if;

  if not exists (
    select 1
      from public.subjects
     where id = p_subject_id
       and school_id = p_school_id
       and status = 'active'
  ) then
    raise exception 'Select an active school subject from this school.';
  end if;

  if exists (
    select 1
      from public.exam_subjects
     where school_id = p_school_id
       and exam_id = p_exam_id
       and class_id = p_class_id
       and subject_id = p_subject_id
  ) then
    raise exception 'This subject already exists in the selected exam class.';
  end if;

  insert into public.class_subjects (school_id, class_id, subject_id)
  values (p_school_id, p_class_id, p_subject_id)
  on conflict (school_id, class_id, subject_id) do nothing;

  insert into public.exam_subjects (
    school_id,
    exam_id,
    class_id,
    subject_id,
    maximum_marks,
    passing_marks
  )
  values (
    p_school_id,
    p_exam_id,
    p_class_id,
    p_subject_id,
    p_maximum_marks,
    p_passing_marks
  )
  returning id into v_exam_subject_id;

  return v_exam_subject_id;
end;
$$;

revoke all on function public.add_exam_subject_to_class(uuid, uuid, uuid, uuid, numeric, numeric) from public, anon;
grant execute on function public.add_exam_subject_to_class(uuid, uuid, uuid, uuid, numeric, numeric) to authenticated;
