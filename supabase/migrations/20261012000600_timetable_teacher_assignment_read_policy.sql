drop policy if exists "Authorized users can read teacher assignments" on public.teacher_assignments;
create policy "Authorized users can read teacher assignments"
on public.teacher_assignments for select to authenticated
using (
  public.has_permission(school_id, 'teachers', 'view')
  or public.has_permission(school_id, 'curriculum', 'view')
  or public.has_permission(school_id, 'exams', 'view')
  or public.has_permission(school_id, 'timetable', 'view')
  or public.is_super_admin()
);
