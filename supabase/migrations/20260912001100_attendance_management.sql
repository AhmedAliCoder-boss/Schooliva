create table public.student_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null,
  enrollment_id uuid not null,
  attendance_date date not null,
  status text not null,
  remarks text,
  marked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, student_id) references public.students (school_id, id) on delete cascade,
  foreign key (school_id, enrollment_id) references public.student_enrollments (school_id, id) on delete restrict,
  unique (school_id, student_id, attendance_date),
  check (status in ('present', 'absent', 'late', 'excused', 'half_day'))
);

create index student_attendance_date_idx
  on public.student_attendance (school_id, attendance_date, status);
create index student_attendance_student_idx
  on public.student_attendance (school_id, student_id, attendance_date desc);
create index student_attendance_enrollment_idx
  on public.student_attendance (school_id, enrollment_id, attendance_date);

create trigger student_attendance_set_updated_at
before update on public.student_attendance
for each row execute function public.set_updated_at();

alter table public.student_attendance enable row level security;

create policy "Authorized users can read attendance"
on public.student_attendance for select to authenticated
using (
  public.is_super_admin()
  or public.has_permission(school_id, 'students.attendance', 'view')
  or public.is_parent_of_student(student_id)
  or public.is_student_record(student_id)
);

create policy "Authorized users can manage attendance"
on public.student_attendance for all to authenticated
using (public.has_permission(school_id, 'students.attendance', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'students.attendance', 'manage') or public.is_super_admin());

create table public.people_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  teacher_id uuid,
  staff_id uuid,
  attendance_date date not null,
  status text not null,
  remarks text,
  marked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (school_id, teacher_id) references public.teachers (school_id, id) on delete cascade,
  foreign key (school_id, staff_id) references public.staff (school_id, id) on delete cascade,
  check ((teacher_id is not null) or (staff_id is not null)),
  check (not (teacher_id is not null and staff_id is not null)),
  check (status in ('present', 'absent', 'late', 'excused', 'half_day'))
);

create unique index people_attendance_teacher_day_key
  on public.people_attendance (school_id, teacher_id, attendance_date)
  where teacher_id is not null;
create unique index people_attendance_staff_day_key
  on public.people_attendance (school_id, staff_id, attendance_date)
  where staff_id is not null;

create trigger people_attendance_set_updated_at
before update on public.people_attendance
for each row execute function public.set_updated_at();

alter table public.people_attendance enable row level security;

create policy "Authorized users can read people attendance"
on public.people_attendance for select to authenticated
using (public.has_permission(school_id, 'teachers', 'view') or public.has_permission(school_id, 'staff', 'view') or public.is_super_admin());

create policy "Authorized users can manage people attendance"
on public.people_attendance for all to authenticated
using (public.has_permission(school_id, 'teachers', 'manage') or public.has_permission(school_id, 'staff', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'teachers', 'manage') or public.has_permission(school_id, 'staff', 'manage') or public.is_super_admin());