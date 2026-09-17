drop policy if exists "Authorized users can update students" on public.students;
create policy "Authorized users can update students"
on public.students for update to authenticated
using (public.has_permission(school_id, 'students', 'update') or public.is_super_admin())
with check (public.has_permission(school_id, 'students', 'update') or public.is_super_admin());

create policy "Managers can read managed profiles"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = profiles.id
      and (public.has_permission(ur.school_id, 'users', 'manage') or public.is_super_admin())
  )
);