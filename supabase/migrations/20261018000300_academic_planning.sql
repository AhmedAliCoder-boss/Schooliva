create table public.academic_plan_units (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_session_id uuid not null,
  term_id uuid,
  class_id uuid not null,
  subject_id uuid not null,
  teacher_id uuid,
  unit_number integer not null,
  title text not null,
  learning_objectives text not null,
  key_concepts text,
  planned_lessons integer not null default 1,
  completed_lessons integer not null default 0,
  planned_start_date date not null,
  planned_end_date date not null,
  assessment_plan text not null,
  learning_resources text,
  teacher_reflection text,
  status text not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, id),
  unique (school_id, academic_session_id, class_id, subject_id, unit_number),
  foreign key (school_id, class_id)
    references public.classes (school_id, id)
    on delete restrict,
  foreign key (school_id, subject_id)
    references public.subjects (school_id, id)
    on delete restrict,
  foreign key (school_id, academic_session_id, class_id, subject_id)
    references public.curriculum_subject_assignments (school_id, academic_session_id, class_id, subject_id)
    on delete restrict,
  foreign key (school_id, academic_session_id, term_id)
    references public.academic_terms (school_id, academic_session_id, id)
    on delete restrict,
  foreign key (school_id, teacher_id)
    references public.teachers (school_id, id)
    on delete restrict,
  check (unit_number > 0),
  check (planned_lessons > 0),
  check (completed_lessons between 0 and planned_lessons),
  check (planned_end_date >= planned_start_date),
  check (length(trim(title)) > 0),
  check (length(trim(learning_objectives)) > 0),
  check (length(trim(assessment_plan)) > 0),
  check (status in ('draft', 'planned', 'in_progress', 'completed', 'archived')),
  check (status <> 'completed' or completed_lessons = planned_lessons)
);

create index academic_plan_units_session_class_idx
  on public.academic_plan_units (school_id, academic_session_id, class_id, status, planned_start_date);
create index academic_plan_units_subject_idx
  on public.academic_plan_units (school_id, academic_session_id, subject_id, unit_number);

create trigger academic_plan_units_set_updated_at
before update on public.academic_plan_units
for each row execute function public.set_updated_at();

alter table public.academic_plan_units enable row level security;

create policy "Authorized users can read academic plans"
on public.academic_plan_units for select to authenticated
using (
  public.has_permission(school_id, 'curriculum', 'view')
  or public.has_permission(school_id, 'curriculum', 'manage')
  or public.is_super_admin()
);

create policy "Authorized users can manage academic plans"
on public.academic_plan_units for all to authenticated
using (
  public.has_permission(school_id, 'curriculum', 'manage')
  or public.is_super_admin()
)
with check (
  public.has_permission(school_id, 'curriculum', 'manage')
  or public.is_super_admin()
);
