# Demo data

Schooliva includes a fictional Pakistani school fixture in `supabase/seed.sql`.
It is intended for local development, screenshots, demos, and disposable test
projects only. It must not be applied to a production database containing real
school records.

## Load locally

Install the Supabase CLI, then run:

```powershell
npx supabase start
npx supabase db reset
```

The seed creates a fictional Islamabad school, academic setup, students,
parents, teachers, attendance, timetable, exams/results, fees/payments,
assignments, library, transport, inventory, notifications, documents, and
certificates.

## Demo accounts

All demo accounts use the password `SchoolivaDemo@123`:

- `admin@schooliva.demo` - school admin
- `principal@schooliva.demo` - principal
- `teacher@schooliva.demo` - teacher
- `accounts@schooliva.demo` - accountant
- `parent@schooliva.demo` - parent of Alina Iqbal
- `student@schooliva.demo` - student account for Alina Iqbal

All names, phone numbers, addresses, emails, IDs, and school records are
fictional. The `.demo` and `.example.test` domains are deliberately non-real.
