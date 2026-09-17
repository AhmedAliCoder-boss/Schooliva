alter table public.parents
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;

create index if not exists parents_profile_idx
  on public.parents (school_id, profile_id)
  where profile_id is not null;

drop policy if exists "People can read allowed parents" on public.parents;
create policy "People can read allowed parents"
on public.parents for select to authenticated
using (
  public.is_super_admin()
  or public.has_permission(school_id, 'parents', 'view')
  or profile_id = (select auth.uid())
);

create policy "Parents can update own profile"
on public.parents for update to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

drop policy if exists "Parents and authorized users can read student links" on public.student_parents;
create policy "Parents and authorized users can read student links"
on public.student_parents for select to authenticated
using (
  public.is_super_admin()
  or public.has_permission(school_id, 'parents', 'view')
  or public.is_parent_of_student(student_id)
);

drop policy if exists "People can read allowed students" on public.students;
create policy "People can read allowed students"
on public.students for select to authenticated
using (
  public.is_super_admin()
  or public.has_permission(school_id, 'students', 'view')
  or public.is_parent_of_student(id)
  or public.is_student_record(id)
);