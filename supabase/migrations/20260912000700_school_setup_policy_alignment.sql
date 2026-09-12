drop policy if exists "Authorized users can manage schools" on public.schools;
create policy "Authorized users can manage schools"
on public.schools for update to authenticated
using (public.has_permission(id, 'school_setup', 'manage') or public.is_super_admin())
with check (public.has_permission(id, 'school_setup', 'manage') or public.is_super_admin());