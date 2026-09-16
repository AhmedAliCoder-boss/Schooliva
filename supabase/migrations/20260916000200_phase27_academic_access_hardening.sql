-- Phase 27: accountants and other non-academic roles must not inherit academic reads.

drop policy if exists "Members can read academic data" on public.academic_sessions;
create policy "Authorized users can read academic data"
on public.academic_sessions for select to authenticated
using (
  public.has_permission(school_id, 'classes', 'view')
  or public.has_permission(school_id, 'academic_sessions', 'manage')
  or public.has_permission(school_id, 'reports', 'view')
  or public.is_super_admin()
);

drop policy if exists "Members can read academic terms" on public.academic_terms;
create policy "Authorized users can read academic terms"
on public.academic_terms for select to authenticated
using (
  public.has_permission(school_id, 'classes', 'view')
  or public.has_permission(school_id, 'academic_sessions', 'manage')
  or public.has_permission(school_id, 'reports', 'view')
  or public.is_super_admin()
);

drop policy if exists "Authorized school members can read classes" on public.classes;
create policy "Authorized users can read classes"
on public.classes for select to authenticated
using (
  public.has_permission(school_id, 'classes', 'view')
  or public.has_permission(school_id, 'classes', 'manage')
  or public.has_permission(school_id, 'reports', 'view')
  or public.is_super_admin()
);

drop policy if exists "Authorized school members can read sections" on public.sections;
create policy "Authorized users can read sections"
on public.sections for select to authenticated
using (
  public.has_permission(school_id, 'classes', 'view')
  or public.has_permission(school_id, 'classes', 'manage')
  or public.has_permission(school_id, 'reports', 'view')
  or public.is_super_admin()
);

drop policy if exists "Authorized school members can read subjects" on public.subjects;
create policy "Authorized users can read subjects"
on public.subjects for select to authenticated
using (
  public.has_permission(school_id, 'subjects', 'view')
  or public.has_permission(school_id, 'subjects', 'manage')
  or public.has_permission(school_id, 'reports', 'view')
  or public.is_super_admin()
);
