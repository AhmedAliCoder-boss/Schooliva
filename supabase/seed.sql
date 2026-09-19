-- Schooliva local/demo fixture.
-- This file is intended for `supabase db reset` on a local or disposable demo project.
-- All identities, contact details, and records below are fictional.

begin;

create extension if not exists pgcrypto;

-- Demo sign-in accounts. Password for every account: SchoolivaDemo@123
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token,
  email_change_token_new, email_change, created_at, updated_at
)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@schooliva.demo', crypt('SchoolivaDemo@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Hamza Ahmed"}', '', '', '', '', now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'principal@schooliva.demo', crypt('SchoolivaDemo@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. Sana Malik"}', '', '', '', '', now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'teacher@schooliva.demo', crypt('SchoolivaDemo@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Usman Raza"}', '', '', '', '', now(), now()),
  ('10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'accounts@schooliva.demo', crypt('SchoolivaDemo@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ayesha Khan"}', '', '', '', '', now(), now()),
  ('10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'parent@schooliva.demo', crypt('SchoolivaDemo@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Farah Iqbal"}', '', '', '', '', now(), now()),
  ('10000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'student@schooliva.demo', crypt('SchoolivaDemo@123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Alina Iqbal"}', '', '', '', '', now(), now())
on conflict (id) do nothing;

insert into auth.identities (id, provider, provider_id, user_id, identity_data, created_at, updated_at)
values
  (gen_random_uuid(), 'email', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '{"sub": "10000000-0000-0000-0000-000000000001", "email": "admin@schooliva.demo", "email_verified": false, "phone_verified": false}', now(), now()),
  (gen_random_uuid(), 'email', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '{"sub": "10000000-0000-0000-0000-000000000002", "email": "principal@schooliva.demo", "email_verified": false, "phone_verified": false}', now(), now()),
  (gen_random_uuid(), 'email', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '{"sub": "10000000-0000-0000-0000-000000000003", "email": "teacher@schooliva.demo", "email_verified": false, "phone_verified": false}', now(), now()),
  (gen_random_uuid(), 'email', '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', '{"sub": "10000000-0000-0000-0000-000000000004", "email": "accounts@schooliva.demo", "email_verified": false, "phone_verified": false}', now(), now()),
  (gen_random_uuid(), 'email', '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', '{"sub": "10000000-0000-0000-0000-000000000005", "email": "parent@schooliva.demo", "email_verified": false, "phone_verified": false}', now(), now()),
  (gen_random_uuid(), 'email', '10000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000006', '{"sub": "10000000-0000-0000-0000-000000000006", "email": "student@schooliva.demo", "email_verified": false, "phone_verified": false}', now(), now())
on conflict (provider, provider_id) do nothing;

update public.profiles
set phone = case id
  when '10000000-0000-0000-0000-000000000001' then '+92 300 1000001'
  when '10000000-0000-0000-0000-000000000002' then '+92 300 1000002'
  when '10000000-0000-0000-0000-000000000003' then '+92 300 1000003'
  when '10000000-0000-0000-0000-000000000004' then '+92 300 1000004'
  when '10000000-0000-0000-0000-000000000005' then '+92 300 1000005'
  when '10000000-0000-0000-0000-000000000006' then '+92 300 1000006'
end
where id in (
  '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000006'
);

insert into public.schools (
  id, name, short_name, slug, code, email, phone, address, city, state, country,
  postal_code, website, campus, school_type, board, medium, principal, established_year, created_by
)
values (
  '20000000-0000-0000-0000-000000000001', 'Margalla Beacon School', 'Margalla Beacon',
  'margalla-beacon-school', 'MBS-001', 'hello@margalla.schooliva.demo', '+92 51 889 2200',
  'Sector F-8, Main Campus', 'Islamabad', 'Islamabad Capital Territory', 'Pakistan', '44000', 'https://margalla.schooliva.demo',
  'F-8 Main Campus', 'K-12', 'FBISE', 'English', 'Dr. Sana Malik', 2011, '10000000-0000-0000-0000-000000000001'
);

insert into public.school_settings (school_id, timezone, currency_code, date_format, locale, academic_year)
values ('20000000-0000-0000-0000-000000000001', 'Asia/Karachi', 'PKR', 'DD-MM-YYYY', 'en-PK', '2026-27');

insert into public.user_roles (user_id, school_id, role_id)
select v.user_id, '20000000-0000-0000-0000-000000000001', r.id
from (values
  ('10000000-0000-0000-0000-000000000001'::uuid, 'school_admin'),
  ('10000000-0000-0000-0000-000000000002'::uuid, 'principal'),
  ('10000000-0000-0000-0000-000000000003'::uuid, 'teacher'),
  ('10000000-0000-0000-0000-000000000004'::uuid, 'accountant'),
  ('10000000-0000-0000-0000-000000000005'::uuid, 'parent'),
  ('10000000-0000-0000-0000-000000000006'::uuid, 'student')
) as v(user_id, role_slug)
join public.roles r on r.slug = v.role_slug and r.school_id is null;

insert into public.academic_sessions (id, school_id, name, code, starts_on, ends_on, is_current, status)
values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Academic Year 2026-27', '2026-27', '2026-04-01', '2027-03-31', true, 'active');

insert into public.academic_terms (id, school_id, academic_session_id, name, code, starts_on, ends_on, is_current, status)
values
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Term 1', 'T1', '2026-04-01', '2026-09-30', true, 'active'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Term 2', 'T2', '2026-10-01', '2027-03-31', false, 'active');

insert into public.classes (id, school_id, name, code, grade_level, description, status)
values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Grade 5', 'G5', 5, 'Upper primary foundation cohort', 'active'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Grade 8', 'G8', 8, 'Middle school learning cohort', 'active');

insert into public.subjects (id, school_id, name, code, description, subject_type, status)
values
  ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Mathematics', 'MATH', 'Numbers, reasoning and problem solving', 'core', 'active'),
  ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Science', 'SCI', 'Practical science and discovery', 'core', 'active'),
  ('50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'English', 'ENG', 'Language, literature and communication', 'core', 'active'),
  ('50000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'Social Studies', 'SST', 'History, geography and civics', 'core', 'active'),
  ('50000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'Computer Applications', 'COMP', 'Digital literacy and creative computing', 'elective', 'active');

insert into public.teachers (
  id, school_id, profile_id, employee_code, first_name, last_name, gender, email, phone,
  specialization, qualification, joining_date, employment_status
)
values
  ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'T-1024', 'Usman', 'Raza', 'male', 'teacher@schooliva.demo', '+92 300 1000003', 'Mathematics', 'M.Sc. Mathematics, B.Ed.', '2019-06-15', 'active'),
  ('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', null, 'T-1025', 'Hira', 'Siddiqui', 'female', 'hira.siddiqui@margalla.schooliva.demo', '+92 300 1000007', 'English and Literature', 'M.A. English, B.Ed.', '2021-07-01', 'active'),
  ('60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', null, 'T-1026', 'Bilal', 'Qureshi', 'male', 'bilal.qureshi@margalla.schooliva.demo', '+92 300 1000008', 'Science', 'M.Sc. Physics, B.Ed.', '2020-04-20', 'active');

insert into public.staff (id, school_id, profile_id, employee_code, first_name, last_name, designation, department, email, phone, joining_date, employment_status)
values
  ('61000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', null, 'ST-301', 'Ayesha', 'Khan', 'Finance Officer', 'Finance', 'accounts@schooliva.demo', '+92 300 1000004', '2022-04-11', 'active'),
  ('61000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', null, 'ST-302', 'Faisal', 'Hussain', 'Librarian', 'Library', 'faisal.hussain@margalla.schooliva.demo', '+92 300 1000009', '2018-08-06', 'active');

insert into public.sections (id, school_id, class_id, name, code, capacity, class_teacher_id, status)
values
  ('41000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Section A', 'A', 30, '60000000-0000-0000-0000-000000000001', 'active'),
  ('41000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'Section A', 'A', 30, '60000000-0000-0000-0000-000000000003', 'active');

insert into public.class_subjects (school_id, class_id, subject_id)
select '20000000-0000-0000-0000-000000000001', c.id, s.id
from (values
  ('40000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000001'::uuid),
  ('40000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid),
  ('40000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000003'::uuid),
  ('40000000-0000-0000-0000-000000000002'::uuid, '50000000-0000-0000-0000-000000000001'::uuid),
  ('40000000-0000-0000-0000-000000000002'::uuid, '50000000-0000-0000-0000-000000000002'::uuid),
  ('40000000-0000-0000-0000-000000000002'::uuid, '50000000-0000-0000-0000-000000000003'::uuid),
  ('40000000-0000-0000-0000-000000000002'::uuid, '50000000-0000-0000-0000-000000000005'::uuid)
) as v(class_id, subject_id)
join public.classes c on c.id = v.class_id
join public.subjects s on s.id = v.subject_id;

insert into public.students (
  id, school_id, profile_id, admission_number, student_identifier, first_name, middle_name, last_name,
  date_of_birth, gender, blood_group, nationality, phone, email, address, admission_date,
  emergency_contact_name, emergency_contact_phone, previous_school, status
)
values
  ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', 'MBS26-0001', 'STU-2026-001', 'Alina', null, 'Iqbal', '2015-08-14', 'female', 'O+', 'Pakistani', null, 'student@schooliva.demo', 'F-8, Islamabad', '2026-04-03', 'Farah Iqbal', '+92 300 1000005', 'Crescent Model School', 'active'),
  ('70000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', null, 'MBS26-0002', 'STU-2026-002', 'Hamza', 'A.', 'Khan', '2015-03-22', 'male', 'A+', 'Pakistani', null, 'hamza.khan@example.test', 'G-10, Islamabad', '2026-04-03', 'Tariq Khan', '+92 300 1000011', 'Roots Millennium School', 'active'),
  ('70000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', null, 'MBS26-0003', 'STU-2026-003', 'Eman', null, 'Siddiqui', '2015-11-09', 'female', 'B+', 'Pakistani', null, 'eman.siddiqui@example.test', 'F-11, Islamabad', '2026-04-04', 'Sadia Siddiqui', '+92 300 1000012', 'Beaconhouse School', 'active'),
  ('70000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', null, 'MBS26-0004', 'STU-2026-004', 'Zain', null, 'Ahmed', '2012-05-18', 'male', 'O+', 'Pakistani', null, 'zain.ahmed@example.test', 'I-8, Islamabad', '2026-04-04', 'Nadia Ahmed', '+92 300 1000013', 'Islamabad Model School', 'active');

insert into public.parents (id, school_id, profile_id, first_name, last_name, relationship, phone, email, address)
values
  ('71000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'Farah', 'Iqbal', 'mother', '+92 300 1000005', 'parent@schooliva.demo', 'F-8, Islamabad'),
  ('71000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', null, 'Tariq', 'Khan', 'father', '+92 300 1000011', 'tariq.khan@example.test', 'G-10, Islamabad'),
  ('71000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', null, 'Sadia', 'Siddiqui', 'mother', '+92 300 1000012', 'sadia.siddiqui@example.test', 'F-11, Islamabad');

insert into public.student_parents (school_id, student_id, parent_id, relationship, is_primary)
values
  ('20000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'mother', true),
  ('20000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000002', 'father', true),
  ('20000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000003', 'mother', true);

insert into public.student_enrollments (id, school_id, student_id, academic_session_id, academic_term_id, class_id, section_id, roll_number, enrolled_on, status)
values
  ('72000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '05', '2026-04-03', 'active'),
  ('72000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '08', '2026-04-03', 'active'),
  ('72000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '12', '2026-04-04', 'active'),
  ('72000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000002', '03', '2026-04-04', 'active');

insert into public.teacher_assignments (school_id, teacher_id, assignment_type, class_id)
values
  ('20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'class', '40000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 'class', '40000000-0000-0000-0000-000000000002');

insert into public.timetable_entries (school_id, academic_session_id, class_id, section_id, subject_id, teacher_id, room, day_of_week, starts_at, ends_at)
values
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'Room 5A', 1, '08:30', '09:20'),
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000003', 'Room 5A', 2, '09:30', '10:20'),
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'Room 8A', 3, '10:30', '11:20'),
  ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000003', 'Room 8A', 4, '11:30', '12:20');

insert into public.student_attendance (school_id, student_id, enrollment_id, attendance_date, status, marked_by)
select '20000000-0000-0000-0000-000000000001', e.student_id, e.id, current_date - d.day_offset,
  case when e.student_id = '70000000-0000-0000-0000-000000000003' and d.day_offset = 3 then 'absent' when d.day_offset = 1 then 'late' else 'present' end,
  '10000000-0000-0000-0000-000000000003'
from public.student_enrollments e
cross join (values (1), (2), (3), (4), (5), (6), (7)) as d(day_offset)
where e.school_id = '20000000-0000-0000-0000-000000000001';

insert into public.assignments (id, school_id, academic_session_id, class_id, section_id, subject_id, teacher_id, title, description, issue_date, due_date, max_marks, status)
values
  ('80000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'Fractions Around Us', 'Find five examples of fractions at home and explain them in a notebook.', current_date - 2, current_date + 5, 20, 'open'),
  ('80000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000003', 'Water Cycle Poster', 'Create a labelled poster showing evaporation, condensation and precipitation.', current_date - 5, current_date - 1, 25, 'closed');

insert into public.assignment_submissions (school_id, assignment_id, student_id, content, submitted_at, status, marks, feedback)
values ('20000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'I used a pizza, a clock, a water bottle, a book and a chocolate bar.', now() - interval '1 day', 'reviewed', 18, 'Clear examples and thoughtful explanations.');

insert into public.exam_types (id, school_id, name, description)
values ('81000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Term 1 Assessment', 'End of first term assessment');

insert into public.grading_scales (id, school_id, name, description)
values ('81000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Margalla A-F Scale', 'School standard grading scale');
insert into public.grade_boundaries (grading_scale_id, grade, min_percentage, max_percentage, grade_point, remark)
values
  ('81000000-0000-0000-0000-000000000002', 'A', 90, 100, 4, 'Outstanding'),
  ('81000000-0000-0000-0000-000000000002', 'B', 80, 89.99, 3, 'Very good'),
  ('81000000-0000-0000-0000-000000000002', 'C', 70, 79.99, 2, 'Good'),
  ('81000000-0000-0000-0000-000000000002', 'D', 60, 69.99, 1, 'Needs support'),
  ('81000000-0000-0000-0000-000000000002', 'F', 0, 59.99, 0, 'Needs improvement');

insert into public.exams (id, school_id, academic_session_id, exam_type_id, name, starts_on, ends_on, status, grading_scale_id, created_by)
values ('82000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'Term 1 Assessment 2026', current_date - 14, current_date - 7, 'draft', '81000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002');

insert into public.exam_subjects (id, school_id, exam_id, subject_id, class_id, maximum_marks, passing_marks)
values
  ('82000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 100, 40),
  ('82000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 100, 40),
  ('82000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', 100, 40);

insert into public.marks (school_id, exam_subject_id, student_id, obtained_marks, grade, remarks, entered_by)
values
  ('20000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 92, 'A', 'Excellent number sense', '10000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', 86, 'B', 'Strong practical understanding', '10000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000001', 94, 'A', 'Confident communicator', '10000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', 78, 'C', 'Keep practising word problems', '10000000-0000-0000-0000-000000000003');

update public.exams set status = 'submitted' where id = '82000000-0000-0000-0000-000000000001';
update public.exams set status = 'reviewed' where id = '82000000-0000-0000-0000-000000000001';
update public.exams set status = 'published' where id = '82000000-0000-0000-0000-000000000001';

alter table public.fee_invoices disable trigger fee_invoices_audit;
alter table public.fee_payments disable trigger fee_payments_audit;
alter table public.fee_invoice_items disable trigger fee_invoice_items_audit;

insert into public.fee_structures (id, school_id, academic_session_id, class_id, fee_type, amount, frequency, due_day)
values
  ('90000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Tuition Fee', 18000, 'term', 10),
  ('90000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Activity Fee', 2500, 'term', 10);

insert into public.fee_invoices (id, school_id, academic_session_id, student_id, invoice_number, due_date, discount, notes, created_by)
values
  ('90000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'INV-2026-0001', current_date + 10, 500, 'Term 1 fee invoice', '10000000-0000-0000-0000-000000000004'),
  ('90000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', 'INV-2026-0002', current_date - 5, 0, 'Pending fee follow-up', '10000000-0000-0000-0000-000000000004');

insert into public.fee_invoice_items (school_id, invoice_id, fee_structure_id, fee_type, description, amount)
values
  ('20000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000001', 'Tuition Fee', 'Term 1 tuition', 18000),
  ('20000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000002', 'Activity Fee', 'Clubs and activities', 2500),
  ('20000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000001', 'Tuition Fee', 'Term 1 tuition', 18000);

insert into public.fee_payments (school_id, invoice_id, payment_reference, amount, payment_method, payment_date, received_by, notes)
values ('20000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003', 'PAY-2026-0001', 10000, 'upi', current_date, '10000000-0000-0000-0000-000000000004', 'Advance payment received');

alter table public.fee_invoices enable trigger fee_invoices_audit;
alter table public.fee_payments enable trigger fee_payments_audit;
alter table public.fee_invoice_items enable trigger fee_invoice_items_audit;

insert into public.library_authors (id, school_id, name, bio)
values ('a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Bapsi Sidhwa', 'Pakistani author featured in the school reading collection.');
insert into public.library_categories (id, school_id, name) values ('a0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Children''s Literature');
insert into public.library_publishers (id, school_id, name) values ('a0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Oxford University Press Pakistan');
insert into public.library_books (id, school_id, title, isbn, author_id, category_id, publisher_id, edition, year_published, summary, rack_location)
values ('a0000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'The Blue Umbrella', '9780143333418', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'School Edition', 2010, 'A gentle story about generosity and growing up.', 'C-03');
insert into public.library_book_copies (id, school_id, book_id, copy_number, status, condition_note)
values
  ('a0000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'BB-001', 'available', 'Good condition'),
  ('a0000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'BB-002', 'available', 'Good condition');
insert into public.library_members (id, school_id, member_type, profile_id, student_id, membership_number)
values ('a0000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 'student', '10000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000001', 'LIB-0001');
insert into public.library_transactions (school_id, copy_id, member_id, issued_on, due_date, status, notes)
values ('20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000007', current_date - 4, current_date + 10, 'issued', 'Reading challenge book');

insert into public.transport_drivers (id, school_id, full_name, license_number, phone)
values ('b0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Naveed Akhtar', 'ICT-042026001', '+92 300 1000021');
insert into public.transport_vehicles (id, school_id, registration_number, vehicle_type, capacity, driver_id, notes)
values ('b0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'DL 1C AB 2026', 'School Bus', 40, 'b0000000-0000-0000-0000-000000000001', 'GPS-enabled demo vehicle');
insert into public.transport_routes (id, school_id, vehicle_id, name, route_code, description)
values ('b0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'F-Sectors Morning Route', 'R-01', 'Residential pickup route');
insert into public.transport_stops (id, school_id, name, stop_type, address, latitude, longitude)
values
  ('b0000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'F-8 Markaz', 'both', 'F-8 Markaz, Islamabad', 33.7080, 73.0435),
  ('b0000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'Margalla Beacon Gate', 'both', 'F-8, Islamabad', 33.7195, 73.0570);
insert into public.transport_route_stops (school_id, route_id, stop_id, stop_order, pickup_time, dropoff_time)
values
  ('20000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004', 1, '07:20', '15:50'),
  ('20000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000005', 2, '08:05', '15:10');
insert into public.transport_student_assignments (school_id, student_id, route_id, pickup_stop_id, dropoff_stop_id, notes)
values ('20000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000005', 'Parent requested front-seat assistance');

insert into public.inventory_categories (id, school_id, name) values ('c0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Classroom Supplies');
insert into public.inventory_units (id, school_id, name, short_name) values ('c0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Piece', 'pcs');
insert into public.inventory_suppliers (id, school_id, name, contact_name, phone, email) values ('c0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Capital Office Supplies', 'Omar Farooq', '+92 300 1000031', 'orders@capital-office.example.test');
insert into public.inventory_items (id, school_id, category_id, unit_id, supplier_id, sku, name, description, cost, location, min_stock_level, current_quantity)
values ('c0000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'SUP-A4-001', 'A4 Exercise Notebooks', 'Ruled 120-page notebooks for classroom use', 48, 'Store Room A', 25, 0);
insert into public.inventory_transactions (school_id, item_id, transaction_type, quantity, unit_cost, reference, notes, created_by)
values ('20000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'stock_in', 120, 48, 'PO-2026-014', 'Opening demo stock', '10000000-0000-0000-0000-000000000001');

insert into public.notifications (school_id, recipient_profile_id, event_type, title, message, entity_type, entity_id, metadata)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'fee_payment', 'Payment received', 'Payment PAY-2026-0001 was recorded for Alina Iqbal.', 'fee_invoice', '90000000-0000-0000-0000-000000000003', '{"amount":10000,"currency":"PKR"}'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'assignment_due', 'Assignment due soon', 'Fractions Around Us is due in five days.', 'assignment', '80000000-0000-0000-0000-000000000001', '{"priority":"normal"}'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', 'result_published', 'Term 1 result published', 'Your Term 1 Assessment result is now available.', 'exam', '82000000-0000-0000-0000-000000000001', '{"average":90.67}');

insert into public.school_documents (school_id, document_type, document_name, storage_path, mime_type, file_size, created_by)
values ('20000000-0000-0000-0000-000000000001', 'policy', 'Student Handbook 2026-27.pdf', 'demo/school-documents/student-handbook-2026.pdf', 'application/pdf', 184320, '10000000-0000-0000-0000-000000000001');

insert into public.certificate_records (school_id, student_id, certificate_type, certificate_number, issued_on, content, status, issued_by)
values ('20000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'bonafide', 'RIS-BON-2026-0001', current_date - 20, '{"purpose":"Scholarship application","academic_year":"2026-27"}', 'issued', '10000000-0000-0000-0000-000000000001');

insert into public.audit_logs (school_id, actor_id, action, entity_type, entity_id, metadata)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'created', 'school', '20000000-0000-0000-0000-000000000001', '{"source":"demo_seed"}'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'created', 'fee_invoice', '90000000-0000-0000-0000-000000000003', '{"source":"demo_seed"}');

commit;
