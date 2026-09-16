create or replace function public.calculate_grade_for_percentage(p_scale_id uuid, p_percentage numeric)
returns text
language sql
stable
as $$
  select grade
  from public.grade_boundaries
  where grading_scale_id = p_scale_id
    and p_percentage >= min_percentage
    and p_percentage <= max_percentage
  order by min_percentage desc
  limit 1;
$$;

create or replace view public.published_exam_results as
select
  m.id,
  m.school_id,
  e.id as exam_id,
  e.name as exam_name,
  e.starts_on,
  e.ends_on,
  e.status as exam_status,
  es.id as exam_subject_id,
  subj.id as subject_id,
  subj.name as subject_name,
  subj.code as subject_code,
  cls.id as class_id,
  cls.name as class_name,
  current_enrollment.section_id,
  sec.name as section_name,
  st.id as student_id,
  st.first_name,
  st.last_name,
  st.middle_name,
  st.admission_number,
  m.obtained_marks,
  es.maximum_marks,
  round((m.obtained_marks / nullif(es.maximum_marks, 0)) * 100, 2) as percentage,
  public.calculate_grade_for_percentage(e.grading_scale_id, round((m.obtained_marks / nullif(es.maximum_marks, 0)) * 100, 2)) as grade,
  m.remarks,
  e.academic_session_id,
  e.grading_scale_id,
  hs.name as school_name,
  session.name as academic_session_name
from public.marks m
join public.exam_subjects es on es.id = m.exam_subject_id
join public.exams e on e.id = es.exam_id and e.status = 'published'
join public.subjects subj on subj.id = es.subject_id and subj.school_id = m.school_id
join public.classes cls on cls.id = es.class_id and cls.school_id = m.school_id
join public.students st on st.id = m.student_id and st.school_id = m.school_id
left join public.student_enrollments current_enrollment
  on current_enrollment.student_id = st.id
 and current_enrollment.school_id = st.school_id
 and current_enrollment.academic_session_id = e.academic_session_id
 and current_enrollment.status = 'active'
left join public.sections sec on sec.id = current_enrollment.section_id and sec.school_id = st.school_id
join public.schools hs on hs.id = m.school_id
join public.academic_sessions session on session.id = e.academic_session_id and session.school_id = m.school_id;

create or replace view public.published_student_result_summary as
select
  school_id,
  student_id,
  exam_id,
  academic_session_id,
  class_id,
  section_id,
  count(*) as subject_count,
  sum(obtained_marks) as total_marks,
  sum(maximum_marks) as total_max_marks,
  round(avg(percentage), 2) as average_percentage,
  max(grade) as highest_grade,
  string_agg(subject_name, ', ' order by subject_name) as subject_names,
  min(exam_name) as exam_name,
  min(starts_on) as starts_on,
  max(ends_on) as ends_on,
  min(academic_session_name) as academic_session_name
from public.published_exam_results
group by school_id, student_id, exam_id, academic_session_id, class_id, section_id;

drop policy if exists "Allowed users can read marks" on public.marks;
create policy "Allowed users can read marks"
on public.marks for select to authenticated
using (
  public.has_permission(school_id, 'grading', 'manage')
  or public.has_permission(school_id, 'exams', 'view')
  or public.is_super_admin()
  or (
    public.is_parent_of_student(student_id)
    and exists (
      select 1
      from public.exam_subjects es
      join public.exams e on e.id = es.exam_id
      where es.id = marks.exam_subject_id
        and e.status = 'published'
    )
  )
  or (
    public.is_student_record(student_id)
    and exists (
      select 1
      from public.exam_subjects es
      join public.exams e on e.id = es.exam_id
      where es.id = marks.exam_subject_id
        and e.status = 'published'
    )
  )
);
