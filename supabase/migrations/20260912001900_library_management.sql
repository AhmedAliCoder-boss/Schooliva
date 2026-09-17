create table public.library_authors (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  bio text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, name)
);

create table public.library_categories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, name)
);

create table public.library_publishers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, name)
);

create table public.library_books (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null,
  isbn text not null,
  author_id uuid not null references public.library_authors (id) on delete restrict,
  category_id uuid not null references public.library_categories (id) on delete restrict,
  publisher_id uuid not null references public.library_publishers (id) on delete restrict,
  edition text,
  year_published int,
  summary text,
  rack_location text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, isbn),
  check (year_published is null or year_published between 0 and 9999)
);

create table public.library_book_copies (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  book_id uuid not null references public.library_books (id) on delete cascade,
  copy_number text not null,
  status text not null default 'available' check (status in ('available', 'issued', 'lost', 'damaged', 'reserved')),
  condition_note text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (book_id, copy_number)
);

create table public.library_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  member_type text not null check (member_type in ('student', 'teacher')),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid references public.students (id) on delete set null,
  teacher_id uuid references public.teachers (id) on delete set null,
  membership_number text not null,
  join_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'inactive', 'blocked')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, membership_number),
  unique (school_id, profile_id)
);

create table public.library_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  copy_id uuid not null references public.library_book_copies (id) on delete restrict,
  member_id uuid not null references public.library_members (id) on delete restrict,
  issued_on date not null default current_date,
  due_date date not null,
  returned_on date,
  status text not null default 'issued' check (status in ('issued', 'returned', 'overdue', 'lost', 'cancelled')),
  fine_amount numeric(10,2) not null default 0 check (fine_amount >= 0),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (returned_on is null or returned_on >= issued_on)
);

create trigger library_authors_set_updated_at before update on public.library_authors for each row execute function public.set_updated_at();
create trigger library_categories_set_updated_at before update on public.library_categories for each row execute function public.set_updated_at();
create trigger library_publishers_set_updated_at before update on public.library_publishers for each row execute function public.set_updated_at();
create trigger library_books_set_updated_at before update on public.library_books for each row execute function public.set_updated_at();
create trigger library_members_set_updated_at before update on public.library_members for each row execute function public.set_updated_at();
create trigger library_transactions_set_updated_at before update on public.library_transactions for each row execute function public.set_updated_at();

create index library_books_school_idx on public.library_books (school_id, title, isbn);
create index library_copies_book_status_idx on public.library_book_copies (school_id, book_id, status);
create index library_members_school_member_idx on public.library_members (school_id, member_type, status);
create index library_transactions_active_idx on public.library_transactions (school_id, member_id, status, due_date);

alter table public.library_authors enable row level security;
alter table public.library_categories enable row level security;
alter table public.library_publishers enable row level security;
alter table public.library_books enable row level security;
alter table public.library_book_copies enable row level security;
alter table public.library_members enable row level security;
alter table public.library_transactions enable row level security;

insert into public.permissions (resource, action, description)
values
  ('library', 'view', 'View library inventory and member records'),
  ('library', 'manage', 'Manage library catalog and circulation'),
  ('library', 'issue', 'Issue library books'),
  ('library', 'return', 'Return library books')
on conflict (resource, action) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.resource = 'library'
where r.school_id is null and r.slug in ('super_admin', 'school_admin', 'principal', 'librarian', 'student', 'teacher')
  and (
    (r.slug in ('super_admin', 'school_admin', 'principal', 'librarian') and p.action in ('view', 'manage', 'issue', 'return'))
    or (r.slug in ('student', 'teacher') and p.action = 'view')
  )
on conflict do nothing;

create or replace function public.ensure_copy_available()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.library_book_copies c
    where c.id = new.copy_id and c.status = 'issued'
  ) then
    raise exception 'This copy is not available to issue';
  end if;

  if exists (
    select 1 from public.library_transactions t
    where t.copy_id = new.copy_id and t.status = 'issued'
  ) then
    raise exception 'Another active issue exists for this copy';
  end if;

  update public.library_book_copies set status = 'issued' where id = new.copy_id;
  return new;
end;
$$;

create or replace function public.release_copy_on_return()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.returned_on is not null and old.returned_on is null then
    update public.library_book_copies set status = 'available' where id = new.copy_id;
  end if;
  return new;
end;
$$;

create trigger library_issue_availability
before insert or update on public.library_transactions
for each row
when (new.status = 'issued')
execute function public.ensure_copy_available();

create trigger library_return_release
after update on public.library_transactions
for each row
when (new.returned_on is not null and old.returned_on is null)
execute function public.release_copy_on_return();

create policy "School members can read library metadata"
on public.library_authors for select to authenticated
using (public.has_permission(school_id, 'library', 'view') or public.has_permission(school_id, 'library', 'manage') or public.is_super_admin());
create policy "Authorized library users can manage authors"
on public.library_authors for all to authenticated
using (public.has_permission(school_id, 'library', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'library', 'manage') or public.is_super_admin());

create policy "School members can read library categories"
on public.library_categories for select to authenticated
using (public.has_permission(school_id, 'library', 'view') or public.has_permission(school_id, 'library', 'manage') or public.is_super_admin());
create policy "Authorized library users can manage categories"
on public.library_categories for all to authenticated
using (public.has_permission(school_id, 'library', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'library', 'manage') or public.is_super_admin());

create policy "School members can read library publishers"
on public.library_publishers for select to authenticated
using (public.has_permission(school_id, 'library', 'view') or public.has_permission(school_id, 'library', 'manage') or public.is_super_admin());
create policy "Authorized library users can manage publishers"
on public.library_publishers for all to authenticated
using (public.has_permission(school_id, 'library', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'library', 'manage') or public.is_super_admin());

create policy "School members can read books"
on public.library_books for select to authenticated
using (public.has_permission(school_id, 'library', 'view') or public.has_permission(school_id, 'library', 'manage') or public.is_super_admin());
create policy "Authorized library users can manage books"
on public.library_books for all to authenticated
using (public.has_permission(school_id, 'library', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'library', 'manage') or public.is_super_admin());

create policy "School members can read copies"
on public.library_book_copies for select to authenticated
using (public.has_permission(school_id, 'library', 'view') or public.has_permission(school_id, 'library', 'manage') or public.is_super_admin());
create policy "Authorized library users can manage copies"
on public.library_book_copies for all to authenticated
using (public.has_permission(school_id, 'library', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'library', 'manage') or public.is_super_admin());

create policy "School members can read members"
on public.library_members for select to authenticated
using (public.has_permission(school_id, 'library', 'view') or public.has_permission(school_id, 'library', 'manage') or public.is_super_admin() or profile_id = (select auth.uid()));
create policy "Authorized library users can manage members"
on public.library_members for all to authenticated
using (public.has_permission(school_id, 'library', 'manage') or public.is_super_admin())
with check (public.has_permission(school_id, 'library', 'manage') or public.is_super_admin());

create policy "School members can read transactions"
on public.library_transactions for select to authenticated
using (
  public.has_permission(school_id, 'library', 'view')
  or public.has_permission(school_id, 'library', 'manage')
  or public.is_super_admin()
  or member_id in (select id from public.library_members where profile_id = (select auth.uid()))
);
create policy "Authorized users can manage transactions"
on public.library_transactions for all to authenticated
using (public.has_permission(school_id, 'library', 'manage') or public.has_permission(school_id, 'library', 'issue') or public.has_permission(school_id, 'library', 'return') or public.is_super_admin())
with check (public.has_permission(school_id, 'library', 'manage') or public.has_permission(school_id, 'library', 'issue') or public.has_permission(school_id, 'library', 'return') or public.is_super_admin());
