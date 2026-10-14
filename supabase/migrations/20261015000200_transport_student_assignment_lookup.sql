create or replace function public.transport_students_for_assignment(target_school_id uuid)
returns table (
  id uuid,
  first_name text,
  last_name text,
  admission_number text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin()
     and not public.has_permission(target_school_id, 'transport', 'manage') then
    raise exception 'Not authorized to view transport student options';
  end if;

  return query
  select s.id, s.first_name, s.last_name, s.admission_number
  from public.students s
  where s.school_id = target_school_id
    and s.is_active
  order by s.last_name, s.first_name, s.admission_number;
end;
$$;

revoke all on function public.transport_students_for_assignment(uuid) from public;
grant execute on function public.transport_students_for_assignment(uuid) to authenticated;
