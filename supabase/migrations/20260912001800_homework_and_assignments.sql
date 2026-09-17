create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_session_id uuid not null,
  class_id uuid not null,
  section_id uuid not null,
  subject_id uuid not null,
  teacher_id uuid not null,
  title text not null,
  description text,
  issue_date date not null,
  due_date date not null,
  max_marks numeric(5,2),
  status text not null default 'open' check (status in ('draft', 'open', 'closed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, academic_session_id) references public.academic_sessions (school_id, id) on delete restrict,
  foreign key (school_id, class_id) references public.classes (school_id, id) on delete restrict,
  foreign key (school_id, section_id) references public.sections (school_id, id) on delete restrict,
  foreign key (school_id, subject_id) references public.subjects (school_id, id) on delete restrict,
  foreign key (school_id, teacher_id) references public.teachers (school_id, id) on delete restrict,
  check (due_date >= issue_date)
);

create table public.assignment_attachments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null,
  content text,
  submitted_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'late', 'reviewed', 'graded')),
  marks numeric(5,2),
  feedback text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, student_id) references public.students (school_id, id) on delete restrict,
  unique (assignment_id, student_id),
  check (marks is null or marks >= 0)
);

create table public.submission_attachments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  submission_id uuid not null references public.assignment_submissions (id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create trigger assignments_set_updated_at before update on public.assignments for each row execute function public.set_updated_at();
create trigger assignment_submissions_set_updated_at before update on public.assignment_submissions for each row execute function public.set_updated_at();

create index assignments_school_session_idx on public.assignments (school_id, academic_session_id, class_id, section_id, due_date);
create index assignments_teacher_idx on public.assignments (school_id, teacher_id, due_date);
create index assignment_submissions_assignment_idx on public.assignment_submissions (school_id, assignment_id, status, student_id);
create index submission_attachments_submission_idx on public.submission_attachments (school_id, submission_id);

alter table public.assignments enable row level security;
alter table public.assignment_attachments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.submission_attachments enable row level security;

insert into public.permissions (resource, action, description)
values
  ('assignments', 'view', 'View assignments and submissions'),
  ('assignments', 'manage', 'Create, update, and remove assignments'),
  ('assignments', 'submit', 'Submit assignment work'),
  ('assignments', 'review', 'Review and mark assignments')
on conflict (resource, action) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.resource = 'assignments'
where r.school_id is null and r.slug in ('super_admin', 'school_admin', 'principal', 'teacher', 'student', 'parent')
  and (
    (r.slug in ('super_admin', 'school_admin', 'principal') and p.action in ('view', 'manage', 'review'))
    or (r.slug = 'teacher' and p.action in ('view', 'manage', 'review'))
    or (r.slug = 'student' and p.action in ('view', 'submit'))
    or (r.slug = 'parent' and p.action in ('view', 'submit'))
  )
on conflict do nothing;

create policy "Authenticated users can read assignments"
on public.assignments for select to authenticated
using (
  public.is_super_admin()
  or public.has_permission(school_id, 'assignments', 'manage')
  or public.has_permission(school_id, 'assignments', 'view')
  or exists (
    select 1 from public.student_enrollments se
    where se.school_id = assignments.school_id
      and se.class_id = assignments.class_id
      and se.section_id = assignments.section_id
      and se.academic_session_id = assignments.academic_session_id
      and se.status = 'active'
      and (se.student_id in (
        select s.id from public.students s where s.profile_id = (select auth.uid()) and s.school_id = assignments.school_id
      ) or public.is_parent_of_student(se.student_id))
  )
);

create policy "Teachers can manage assignments"
on public.assignments for all to authenticated
using (public.has_permission(school_id, 'assignments', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'assignments', 'manage') or public.is_super_admin());

create policy "Teachers and submitters can manage attachments"
on public.assignment_attachments for all to authenticated
using (public.has_permission(school_id, 'assignments', 'manage') or public.is_super_admin() or uploaded_by = (select auth.uid()))
with check (public.has_permission(school_id, 'assignments', 'manage') or public.is_super_admin() or uploaded_by = (select auth.uid()));

create policy "Students can read submissions for own assignments"
on public.assignment_submissions for select to authenticated
using (
  public.is_super_admin()
  or public.has_permission(school_id, 'assignments', 'manage')
  or public.has_permission(school_id, 'assignments', 'review')
  or student_id in (select s.id from public.students s where s.profile_id = (select auth.uid()) and s.school_id = assignment_submissions.school_id)
  or public.is_parent_of_student(student_id)
);

create policy "Students can manage own submissions"
on public.assignment_submissions for all to authenticated
using (
  public.is_super_admin()
  or public.has_permission(school_id, 'assignments', 'manage')
  or public.has_permission(school_id, 'assignments', 'review')
  or student_id in (select s.id from public.students s where s.profile_id = (select auth.uid()) and s.school_id = assignment_submissions.school_id)
)
with check (
  public.is_super_admin()
  or public.has_permission(school_id, 'assignments', 'manage')
  or public.has_permission(school_id, 'assignments', 'review')
  or student_id in (select s.id from public.students s where s.profile_id = (select auth.uid()) and s.school_id = assignment_submissions.school_id)
);

create policy "Students and teachers can manage submission attachments"
on public.submission_attachments for all to authenticated
using (public.has_permission(school_id, 'assignments', 'manage') or public.has_permission(school_id, 'assignments', 'review') or public.is_super_admin() or uploaded_by = (select auth.uid()))
with check (public.has_permission(school_id, 'assignments', 'manage') or public.has_permission(school_id, 'assignments', 'review') or public.is_super_admin() or uploaded_by = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('assignment-files', 'assignment-files', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('assignment-submissions', 'assignment-submissions', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

create policy "Teachers can upload assignment files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'assignment-files'
  and owner = auth.uid()
);

create policy "Teachers can read assignment files"
on storage.objects for select to authenticated
using (
  bucket_id = 'assignment-files'
  and (
    owner = auth.uid()
    or exists (
      select 1
      from public.assignments a
      join public.teachers t on t.id = a.teacher_id
      where a.id::text = split_part(name, '/', 2)
        and t.profile_id = auth.uid()
    )
  )
);

create policy "Students can upload submission files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'assignment-submissions'
  and owner = auth.uid()
);

create policy "Students and teachers can read submission files"
on storage.objects for select to authenticated
using (
  bucket_id = 'assignment-submissions'
  and (
    owner = auth.uid()
    or exists (
      select 1
      from public.assignment_submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.id::text = split_part(name, '/', 2)
        and (
          a.teacher_id in (select t.id from public.teachers t where t.profile_id = auth.uid())
          or s.student_id in (select st.id from public.students st where st.profile_id = auth.uid())
        )
    )
  )
);
