drop policy if exists "Members can read exam types" on public.exam_types;
create policy "Members can read exam types"
on public.exam_types for select to authenticated
using (public.has_school_access(school_id) or public.is_super_admin());

drop policy if exists "Authorized users can manage exam types" on public.exam_types;
create policy "Authorized users can manage exam types"
on public.exam_types for all to authenticated
using (public.has_permission(school_id, 'exams', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'exams', 'manage') or public.is_super_admin());
