create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  avatar_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  resource text not null,
  action text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (resource, action),
  check (length(trim(resource)) > 0),
  check (length(trim(action)) > 0)
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  code text not null,
  email text,
  phone text,
  address text,
  city text,
  state text,
  country text,
  postal_code text,
  logo_path text,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (slug),
  unique (code),
  check (length(trim(name)) > 0),
  check (slug = lower(slug)),
  check (length(trim(slug)) > 0),
  check (length(trim(code)) > 0)
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (length(trim(name)) > 0),
  check (slug = lower(slug)),
  check (length(trim(slug)) > 0)
);

create unique index roles_global_slug_key
  on public.roles (slug)
  where school_id is null;

create unique index roles_school_slug_key
  on public.roles (school_id, slug)
  where school_id is not null;

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (role_id, permission_id)
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, school_id, role_id)
);

create or replace function public.validate_user_role_school()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  assigned_role_school_id uuid;
begin
  select school_id
    into assigned_role_school_id
    from public.roles
   where id = new.role_id;

  if assigned_role_school_id is not null
     and assigned_role_school_id <> new.school_id then
    raise exception 'Role % does not belong to school %', new.role_id, new.school_id;
  end if;

  return new;
end;
$$;

create trigger user_roles_validate_school
before insert or update on public.user_roles
for each row execute function public.validate_user_role_school();

create table public.school_settings (
  school_id uuid primary key references public.schools (id) on delete cascade,
  timezone text not null default 'UTC',
  currency_code char(3) not null default 'USD',
  date_format text not null default 'YYYY-MM-DD',
  locale text not null default 'en',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (currency_code = upper(currency_code)),
  check (length(currency_code) = 3)
);

create table public.academic_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  code text not null,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  unique (school_id, code),
  check (length(trim(name)) > 0),
  check (length(trim(code)) > 0),
  check (ends_on >= starts_on)
);

create unique index one_current_academic_session_per_school
  on public.academic_sessions (school_id)
  where is_current;

create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_session_id uuid not null,
  name text not null,
  code text not null,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  unique (school_id, academic_session_id, id),
  unique (school_id, academic_session_id, code),
  foreign key (school_id, academic_session_id)
    references public.academic_sessions (school_id, id) on delete cascade,
  check (length(trim(name)) > 0),
  check (length(trim(code)) > 0),
  check (ends_on >= starts_on)
);

create unique index one_current_academic_term_per_session
  on public.academic_terms (school_id, academic_session_id)
  where is_current;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  code text not null,
  grade_level integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  unique (school_id, code),
  check (length(trim(name)) > 0),
  check (length(trim(code)) > 0),
  check (grade_level is null or grade_level between 0 and 20)
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null,
  name text not null,
  code text not null,
  capacity integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  unique (school_id, class_id, id),
  unique (school_id, class_id, code),
  foreign key (school_id, class_id)
    references public.classes (school_id, id) on delete cascade,
  check (length(trim(name)) > 0),
  check (length(trim(code)) > 0),
  check (capacity is null or capacity > 0)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  code text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  unique (school_id, code),
  check (length(trim(name)) > 0),
  check (length(trim(code)) > 0)
);

create table public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null,
  subject_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  unique (school_id, class_id, subject_id),
  foreign key (school_id, class_id)
    references public.classes (school_id, id) on delete cascade,
  foreign key (school_id, subject_id)
    references public.subjects (school_id, id) on delete cascade
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  admission_number text not null,
  first_name text not null,
  middle_name text,
  last_name text not null,
  date_of_birth date,
  gender text,
  phone text,
  email text,
  address text,
  photo_path text,
  admission_date date,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  unique (school_id, admission_number),
  check (length(trim(admission_number)) > 0),
  check (length(trim(first_name)) > 0),
  check (length(trim(last_name)) > 0),
  check (gender is null or gender in ('female', 'male', 'non_binary', 'undisclosed'))
);

create table public.parents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  first_name text not null,
  last_name text not null,
  relationship text,
  phone text,
  email text,
  address text,
  photo_path text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  check (length(trim(first_name)) > 0),
  check (length(trim(last_name)) > 0)
);

create table public.student_parents (
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null,
  parent_id uuid not null,
  relationship text,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (school_id, student_id, parent_id),
  foreign key (school_id, student_id)
    references public.students (school_id, id) on delete cascade,
  foreign key (school_id, parent_id)
    references public.parents (school_id, id) on delete cascade
);

create unique index one_primary_parent_per_student
  on public.student_parents (school_id, student_id)
  where is_primary;

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  employee_code text not null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  specialization text,
  joining_date date,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  unique (school_id, employee_code),
  check (length(trim(employee_code)) > 0),
  check (length(trim(first_name)) > 0),
  check (length(trim(last_name)) > 0)
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  employee_code text not null,
  first_name text not null,
  last_name text not null,
  designation text not null,
  email text,
  phone text,
  joining_date date,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  unique (school_id, employee_code),
  check (length(trim(employee_code)) > 0),
  check (length(trim(first_name)) > 0),
  check (length(trim(last_name)) > 0),
  check (length(trim(designation)) > 0)
);

create table public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null,
  academic_session_id uuid not null,
  academic_term_id uuid,
  class_id uuid not null,
  section_id uuid not null,
  roll_number text,
  enrolled_on date not null default current_date,
  status text not null default 'active',
  withdrawn_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  unique (school_id, student_id, academic_session_id),
  foreign key (school_id, student_id)
    references public.students (school_id, id) on delete cascade,
  foreign key (school_id, academic_session_id)
    references public.academic_sessions (school_id, id) on delete restrict,
  foreign key (school_id, academic_session_id, academic_term_id)
    references public.academic_terms (school_id, academic_session_id, id) on delete restrict,
  foreign key (school_id, class_id)
    references public.classes (school_id, id) on delete restrict,
  foreign key (school_id, class_id, section_id)
    references public.sections (school_id, class_id, id) on delete restrict,
  check (status in ('active', 'completed', 'withdrawn')), 
  check (status <> 'withdrawn' or withdrawn_at is not null)
);

create index profiles_active_idx on public.profiles (is_active);
create index roles_school_idx on public.roles (school_id);
create index role_permissions_permission_idx on public.role_permissions (permission_id);
create index user_roles_user_school_idx on public.user_roles (user_id, school_id);
create index academic_sessions_school_dates_idx on public.academic_sessions (school_id, starts_on, ends_on);
create index academic_terms_session_dates_idx on public.academic_terms (school_id, academic_session_id, starts_on, ends_on);
create index sections_class_idx on public.sections (school_id, class_id);
create index class_subjects_subject_idx on public.class_subjects (school_id, subject_id);
create index students_school_name_idx on public.students (school_id, last_name, first_name);
create index students_active_idx on public.students (school_id, is_active) where deleted_at is null;
create index parents_school_name_idx on public.parents (school_id, last_name, first_name);
create index student_parents_parent_idx on public.student_parents (school_id, parent_id);
create index teachers_school_name_idx on public.teachers (school_id, last_name, first_name);
create index staff_school_name_idx on public.staff (school_id, last_name, first_name);
create index enrollments_student_idx on public.student_enrollments (school_id, student_id);
create index enrollments_class_section_idx on public.student_enrollments (school_id, class_id, section_id);
create index enrollments_session_idx on public.student_enrollments (school_id, academic_session_id);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger schools_set_updated_at
before update on public.schools
for each row execute function public.set_updated_at();

create trigger roles_set_updated_at
before update on public.roles
for each row execute function public.set_updated_at();

create trigger school_settings_set_updated_at
before update on public.school_settings
for each row execute function public.set_updated_at();

create trigger academic_sessions_set_updated_at
before update on public.academic_sessions
for each row execute function public.set_updated_at();

create trigger academic_terms_set_updated_at
before update on public.academic_terms
for each row execute function public.set_updated_at();

create trigger classes_set_updated_at
before update on public.classes
for each row execute function public.set_updated_at();

create trigger sections_set_updated_at
before update on public.sections
for each row execute function public.set_updated_at();

create trigger subjects_set_updated_at
before update on public.subjects
for each row execute function public.set_updated_at();

create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();

create trigger parents_set_updated_at
before update on public.parents
for each row execute function public.set_updated_at();

create trigger teachers_set_updated_at
before update on public.teachers
for each row execute function public.set_updated_at();

create trigger staff_set_updated_at
before update on public.staff
for each row execute function public.set_updated_at();

create trigger student_enrollments_set_updated_at
before update on public.student_enrollments
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.schools enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.school_settings enable row level security;
alter table public.academic_sessions enable row level security;
alter table public.academic_terms enable row level security;
alter table public.classes enable row level security;
alter table public.sections enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;
alter table public.students enable row level security;
alter table public.parents enable row level security;
alter table public.student_parents enable row level security;
alter table public.teachers enable row level security;
alter table public.staff enable row level security;
alter table public.student_enrollments enable row level security;